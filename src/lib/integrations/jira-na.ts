import prisma from "../prisma";

interface JiraWorklog {
  id: string;
  author: { accountId: string };
  started: string;
  timeSpentSeconds: number;
  comment?: { content?: Array<{ content?: Array<{ text?: string }> }> };
}

interface JiraIssue {
  key: string;
  fields: {
    components?: Array<{ name: string }>;
    issuetype?: { name: string };
  };
  worklogs?: JiraWorklog[];
}

interface SyncResult {
  created: number;
  skipped: number;
  errors: string[];
}

export class JiraNAConnector {
  private baseUrl: string;
  private email: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.JIRA_NA_BASE_URL ?? "";
    this.email = process.env.JIRA_NA_EMAIL ?? "";
    this.token = process.env.JIRA_NA_API_TOKEN ?? "";
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.email}:${this.token}`).toString("base64")}`;
  }

  async sync(
    dateFrom: string,
    dateTo: string,
    mode: "full" | "delta",
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };
    const log = await prisma.syncLog.create({
      data: {
        source: "jira_na",
        syncType: mode,
        startedAt: new Date(),
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      },
    });

    try {
      const issues = await this.fetchIssuesWithWorklogs(dateFrom, dateTo);

      for (const issue of issues) {
        for (const wl of issue.worklogs ?? []) {
          try {
            await this.processWorklog(issue, wl, result);
          } catch (err) {
            result.errors.push(String(err));
          }
        }
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
        data: { completedAt: new Date(), errorMessage: String(err) },
      });
      throw err;
    }

    return result;
  }

  private async fetchIssuesWithWorklogs(
    dateFrom: string,
    dateTo: string,
  ): Promise<JiraIssue[]> {
    const jql = `worklogDate >= "${dateFrom}" AND worklogDate <= "${dateTo}"`;
    const issues: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    const maxResults = 100;

    while (true) {
      const body: Record<string, unknown> = { jql, maxResults, fields: ["key", "components", "issuetype"] };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await fetch(
        `${this.baseUrl}/rest/api/3/search/jql`,
        {
          method: "POST",
          headers: { Authorization: this.authHeader, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`Jira search error: ${res.status}`);
      const data = await res.json() as { issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean };

      for (const issue of data.issues) {
        const worklogs = await this.fetchWorklogs(issue.key, dateFrom, dateTo);
        issues.push({ ...issue, worklogs });
      }

      if (data.isLast || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }

    return issues;
  }

  private async fetchWorklogs(
    issueKey: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<JiraWorklog[]> {
    const res = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/worklog`,
      { headers: { Authorization: this.authHeader, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = await res.json() as { worklogs: JiraWorklog[] };
    const from = new Date(dateFrom).getTime();
    const to = new Date(dateTo).getTime();
    return (data.worklogs ?? []).filter((wl) => {
      const t = new Date(wl.started).getTime();
      return t >= from && t <= to;
    });
  }

  private async processWorklog(
    issue: JiraIssue,
    wl: JiraWorklog,
    result: SyncResult,
  ): Promise<void> {
    const externalRef = `jira_na:${wl.id}`;
    const date = new Date(wl.started);
    const hours = wl.timeSpentSeconds / 3600;

    const components = issue.fields.components ?? [];
    const isNonBillable = components.length === 0;

    const person = await prisma.person.findFirst({
      where: { tempoAccountId: wl.author.accountId },
    });
    if (!person) {
      result.skipped++;
      return;
    }

    if (isNonBillable) {
      const sourceMapping = await prisma.nonBillableSourceMapping.findFirst({
        where: { identifierValue: issue.key.split("-")[0] },
      });

      const squadMembership = await prisma.squadMembership.findFirst({
        where: {
          personId: person.id,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        orderBy: { allocationPct: "desc" },
      });

      if (!sourceMapping || !squadMembership) {
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
      return;
    }

    const componentName = components[0]?.name;
    if (!componentName) {
      result.skipped++;
      return;
    }

    const clientMapping = await prisma.jiraComponentClientMapping.findFirst({
      where: {
        componentKey: componentName,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
    });
    if (!clientMapping) {
      result.skipped++;
      return;
    }

    const roleType = await this.resolveRole(person.id, date);
    if (!roleType) {
      result.skipped++;
      return;
    }

    const existing = await prisma.hourRecord.findUnique({ where: { externalRef } });
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
        source: "jira_na",
        budgetSource: "retainer",
        externalRef,
        issueKey: issue.key,
      },
    });
    result.created++;
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
