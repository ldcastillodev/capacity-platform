import prisma from "../prisma";
import type { Prisma, Person, NonBillableSourceMapping, SquadMembership, PersonRole } from "@prisma/client";

type JiraMappingWithContract = {
  id: number; jiraInstance: string; componentKey: string; contractId: number;
  effectiveFrom: Date; effectiveTo: Date | null;
  contract: { sow: { clientId: number } };
};

interface JiraWorklog {
  id: string;
  author: { accountId: string, emailAddress: string };
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

interface WorklogLookupContext {
  personByEmail: Map<string, Person>;
  sourceMappingByPrefix: Map<string, NonBillableSourceMapping>;
  squadMembershipsByPerson: Map<number, SquadMembership[]>;
  clientMappings: JiraMappingWithContract[];
  personRoles: PersonRole[];
  existingRefs: Set<string | null>;
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

      // Collect all externalRefs upfront for batch existence check
      const allExternalRefs: string[] = [];
      for (const issue of issues) {
        for (const wl of issue.worklogs ?? []) {
          allExternalRefs.push(`jira_na:${wl.id}`);
        }
      }

      // Pre-fetch all lookup data in parallel
      const now = new Date();
      const [
        persons,
        nonBillableSourceMappings,
        squadMemberships,
        clientMappings,
        personRoles,
        existingHourRecords,
        existingNonBillableEntries,
      ] = await Promise.all([
        prisma.person.findMany(),
        prisma.nonBillableSourceMapping.findMany({ where: { source: "jira_na" } }),
        prisma.squadMembership.findMany({
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          },
          orderBy: { allocationPct: "desc" },
        }),
        prisma.jiraComponentClientMapping.findMany({ include: { contract: { include: { sow: true } } } }),
        prisma.personRole.findMany({ where: { isPrimary: true } }),
        prisma.hourRecord.findMany({
          where: { externalRef: { in: allExternalRefs } },
          select: { externalRef: true },
        }),
        prisma.nonBillableEntry.findMany({
          where: { externalRef: { in: allExternalRefs } },
          select: { externalRef: true },
        }),
      ]);

      // Build lookup maps
      const personByEmail = new Map(persons.map(p => [p.email, p]));
      const sourceMappingByPrefix = new Map(
        nonBillableSourceMappings.map(m => [m.identifierValue, m]),
      );
      const squadMembershipsByPerson = new Map<number, typeof squadMemberships>();
      for (const sm of squadMemberships) {
        if (!squadMembershipsByPerson.has(sm.personId)) {
          squadMembershipsByPerson.set(sm.personId, []);
        }
        squadMembershipsByPerson.get(sm.personId)!.push(sm);
      }
      const existingRefs = new Set([
        ...existingHourRecords.map(r => r.externalRef),
        ...existingNonBillableEntries.map(r => r.externalRef),
      ]);

      const ctx: WorklogLookupContext = {
        personByEmail,
        sourceMappingByPrefix,
        squadMembershipsByPerson,
        clientMappings,
        personRoles,
        existingRefs,
      };

      await this.processWorklogs(issues, ctx, result);

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

  private async processWorklogs(
    issues: JiraIssue[],
    ctx: WorklogLookupContext,
    result: SyncResult,
  ): Promise<void> {
    const hourRecordsToCreate: Prisma.HourRecordCreateManyInput[] = [];
    const nonBillableEntriesToCreate: Prisma.NonBillableEntryCreateManyInput[] = [];

    for (const issue of issues) {
      for (const wl of issue.worklogs ?? []) {
        try {
          const externalRef = `jira_na:${wl.id}`;
          if (ctx.existingRefs.has(externalRef)) {
            result.skipped++;
            continue;
          }

          const date = new Date(wl.started);
          const hours = wl.timeSpentSeconds / 3600;
          const components = issue.fields.components ?? [];
          const isNonBillable = ctx.sourceMappingByPrefix.has(issue.key);
  
          const person = ctx.personByEmail.get(wl.author.emailAddress);
          if (!person) {
            result.skipped++;
            continue;
          }

          if (isNonBillable) {
            const sourceMapping = ctx.sourceMappingByPrefix.get(issue.key);
            const squadList = ctx.squadMembershipsByPerson.get(person.id);
            const squadMembership = squadList?.[0]; // already sorted by allocationPct desc

            if (!sourceMapping || !squadMembership) {
              result.skipped++;
              continue;
            }

            nonBillableEntriesToCreate.push({
              personId: person.id,
              squadId: squadMembership.squadId,
              date,
              hours,
              categoryId: sourceMapping.categoryId,
              externalRef,
            });
            result.created++;
            continue;
          }

          const componentName = components[0]?.name;
          if (!componentName) {
            result.skipped++;
            continue;
          }

          const clientMapping = ctx.clientMappings.find(
            m =>
              m.componentKey === componentName &&
              m.effectiveFrom <= date &&
              (m.effectiveTo === null || m.effectiveTo >= date),
          );
          if (!clientMapping) {
            result.skipped++;
            continue;
          }

          const role = ctx.personRoles.find(
            r =>
              r.personId === person.id &&
              r.effectiveFrom <= date &&
              (r.effectiveTo === null || r.effectiveTo >= date),
          );
          if (!role) {
            result.skipped++;
            continue;
          }

          hourRecordsToCreate.push({
            personId: person.id,
            clientId: clientMapping.contract.sow.clientId,
            date,
            hours,
            roleType: role.roleType,
            source: "jira_na" as const,
            budgetSource: "retainer" as const,
            externalRef,
            issueKey: issue.key,
            contractId: clientMapping.contractId,
          });
          result.created++;
        } catch (err) {
          result.errors.push(String(err));
        }
      }
    }

    // Batch insert in chunks of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < hourRecordsToCreate.length; i += BATCH_SIZE) {
      await prisma.hourRecord.createMany({
        data: hourRecordsToCreate.slice(i, i + BATCH_SIZE),
        skipDuplicates: true,
      });
    }
    for (let i = 0; i < nonBillableEntriesToCreate.length; i += BATCH_SIZE) {
      await prisma.nonBillableEntry.createMany({
        data: nonBillableEntriesToCreate.slice(i, i + BATCH_SIZE),
        skipDuplicates: true,
      });
    }
  }

  private async fetchIssuesWithWorklogs(
    dateFrom: string,
    dateTo: string,
  ): Promise<JiraIssue[]> {
    // get non-billable mappings to filter in jql
    const nonBillableSourceMappings = await prisma.nonBillableSourceMapping.findMany({
        where: { source: "jira_na" },
      });
    const nonBillableTicketkeys = nonBillableSourceMappings.filter(m => m.identifierType === "issue_key").map(m => m.identifierValue);
    // get components to filter in jql
    const components = (await prisma.jiraComponentClientMapping.findMany()).map(component => component.componentKey);
    
    const jql = this.generateJql(dateFrom, dateTo, nonBillableTicketkeys, components);

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

    return issues.filter(issue => issue.worklogs && issue.worklogs.length > 0);
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

  private generateJql(
    dateFrom: string,
    dateTo: string,
    ticketKeys: string[] = [],
    components: string[] = []
  ): string {
    // Base JQL with mandatory date range
    let jql = `worklogDate >= "${dateFrom}" AND worklogDate <= "${dateTo}"`;
    
    const optionalClauses: string[] = [];

    // Validate and format ticketKeys
    if (ticketKeys.length > 0) {
      const formattedKeys = ticketKeys.map(key => `'${key}'`).join(', ');
      optionalClauses.push(`issueKey IN (${formattedKeys})`);
    }

    // Validate and format components
    if (components.length > 0) {
      const formattedComponents = components.map(comp => `'${comp}'`).join(', ');
      optionalClauses.push(`component IN (${formattedComponents})`);
    }

    // Dynamically join optional clauses
    if (optionalClauses.length > 0) {
      // If both exist, join with OR and wrap in parentheses.
      // If only one exists, leave it without parentheses.
      const internalCondition = optionalClauses.length > 1 
        ? `(${optionalClauses.join(' OR ')})` 
        : optionalClauses[0];
      
      jql += ` AND ${internalCondition}`;
    }

    return jql;
  }
}
