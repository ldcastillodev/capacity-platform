import prisma from "../prisma";

const TEMPO_BASE = "https://api.tempo.io/4";
const NB_PROJECT_PREFIX = "LC-";

interface TempoWorklog {
  tempoWorklogId: number;
  issue: { id: number };
  timeSpentSeconds: number;
  startDate: string;
  author: { accountId: string };
  attributes?: {
    values?: Array<{ key: string; value: string }>;
  };
  description?: string;
}

interface SyncResult {
  created: number;
  skipped: number;
  errors: string[];
}

export class TempoConnector {
  private token: string;
  private jiraBaseUrl: string;
  private jiraEmail: string;
  private jiraToken: string;
  private issueKeyCache: Map<number, string> = new Map();

  constructor() {
    this.token = process.env.TEMPO_API_TOKEN ?? "";
    this.jiraBaseUrl = process.env.JIRA_EMEA_BASE_URL ?? "";
    this.jiraEmail = process.env.JIRA_EMEA_EMAIL ?? "";
    this.jiraToken = process.env.JIRA_EMEA_API_TOKEN ?? "";
  }

  async sync(
    dateFrom: string,
    dateTo: string,
    mode: "full" | "delta",
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };
    const log = await prisma.syncLog.create({
      data: {
        source: "tempo",
        syncType: mode,
        startedAt: new Date(),
      },
    });

    try {
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const url = `${TEMPO_BASE}/worklogs?from=${dateFrom}&to=${dateTo}&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) {
          throw new Error(`Tempo API error: ${res.status}`);
        }
        const data = await res.json() as { results: TempoWorklog[]; metadata: { count: number; limit: number; offset: number } };
        const worklogs = data.results ?? [];

        for (const wl of worklogs) {
          try {
            await this.processWorklog(wl, result);
          } catch (err) {
            result.errors.push(String(err));
          }
        }

        offset += limit;
        hasMore = worklogs.length === limit;
      }

      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          completedAt: new Date(),
          recordsFetched: result.created + result.skipped,
          recordsCreated: result.created,
          recordsSkipped: result.skipped,
          errorMessage: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
        },
      });
    } catch (err) {
      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          completedAt: new Date(),
          errorMessage: String(err),
        },
      });
      throw err;
    }

    return result;
  }

  private async processWorklog(wl: TempoWorklog, result: SyncResult): Promise<void> {
    const externalRef = String(wl.tempoWorklogId);
    const issueKey = await this.resolveIssueKey(wl.issue.id);
    const hours = wl.timeSpentSeconds / 3600;
    const date = new Date(wl.startDate);

    if (issueKey.startsWith(NB_PROJECT_PREFIX)) {
      await this.upsertNbEntry(externalRef, wl, issueKey, hours, date, result);
      return;
    }

    const deliveryKey = this.extractDeliveryKey(wl);
    const nbMapping = deliveryKey
      ? await prisma.nonBillableSourceMapping.findFirst({
          where: { identifierValue: deliveryKey },
        })
      : null;

    if (nbMapping) {
      await this.upsertNbEntry(externalRef, wl, deliveryKey!, hours, date, result);
      return;
    }

    const accountKey = deliveryKey;
    if (!accountKey) {
      result.skipped++;
      return;
    }

    const clientMapping = await prisma.tempoAccountClientMapping.findFirst({
      where: {
        accountKey,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
    });
    if (!clientMapping) {
      result.skipped++;
      return;
    }

    const person = await prisma.person.findFirst({
      where: { tempoAccountId: wl.author.accountId },
    });
    if (!person) {
      result.skipped++;
      return;
    }

    const roleType = await this.resolveRole(person.id, date);
    if (!roleType) {
      result.skipped++;
      return;
    }

    const existing = await prisma.hourRecord.findUnique({
      where: { externalRef },
    });

    if (existing) {
      result.skipped++;
      return;
    }

    await prisma.hourRecord.create({
      data: {
        personId: person.id,
        clientId: clientMapping.clientId,
        date,
        hours,
        roleType: roleType as never,
        source: "tempo",
        budgetSource: "retainer",
        externalRef,
        description: wl.description,
        issueKey,
      },
    });
    result.created++;
  }

  private async upsertNbEntry(
    externalRef: string,
    wl: TempoWorklog,
    sourceKey: string,
    hours: number,
    date: Date,
    result: SyncResult,
  ): Promise<void> {
    const person = await prisma.person.findFirst({
      where: { tempoAccountId: wl.author.accountId },
    });
    if (!person) {
      result.skipped++;
      return;
    }

    const sourceMapping = await prisma.nonBillableSourceMapping.findFirst({
      where: { identifierValue: sourceKey },
    });
    if (!sourceMapping) {
      result.skipped++;
      return;
    }

    const squadMembership = await prisma.squadMembership.findFirst({
      where: {
        personId: person.id,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { allocationPct: "desc" },
    });
    if (!squadMembership) {
      result.skipped++;
      return;
    }

    const existing = await prisma.nonBillableEntry.findUnique({
      where: { externalRef },
    });
    if (existing) {
      result.skipped++;
      return;
    }

    await prisma.nonBillableEntry.create({
      data: {
        personId: person.id,
        squadId: squadMembership.squadId,
        date,
        hours,
        categoryId: sourceMapping.categoryId,
        externalRef,
      },
    });
    result.created++;
  }

  private async resolveIssueKey(issueId: number): Promise<string> {
    if (this.issueKeyCache.has(issueId)) {
      return this.issueKeyCache.get(issueId)!;
    }
    try {
      const res = await fetch(`${this.jiraBaseUrl}/rest/api/3/issue/${issueId}?fields=key`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.jiraEmail}:${this.jiraToken}`).toString("base64")}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) return `ISSUE-${issueId}`;
      const data = await res.json() as { key: string };
      const key = data.key;
      this.issueKeyCache.set(issueId, key);
      return key;
    } catch {
      return `ISSUE-${issueId}`;
    }
  }

  private extractDeliveryKey(wl: TempoWorklog): string | null {
    const deliveryAttr = wl.attributes?.values?.find((a) => a.key === "_Delivery_");
    return deliveryAttr?.value ?? null;
  }

  private async resolveRole(personId: number, date: Date): Promise<string | null> {
    const role = await prisma.personRole.findFirst({
      where: {
        personId,
        isPrimary: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
    });
    return role?.roleType ?? null;
  }
}
