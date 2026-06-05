import prisma from "../prisma";
import type { Prisma, Person, NonBillableSourceMapping, PersonRole, SquadMembership } from "@prisma/client";

type JiraMappingWithContract = {
  id: number; jiraInstance: string; componentKey: string; contractId: number;
  effectiveFrom: Date; effectiveTo: Date | null;
  contract: { sow: { clientId: number } };
};

type ContractWithExtension = {
  id: number;
  assignedHours: number;
  childContract: { id: number; type: string } | null;
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
  clientMappings: JiraMappingWithContract[];
  personRoles: PersonRole[];
  squadMemberships: SquadMembership[];
  existingRefs: Set<string | null>;
  contractById: Map<number, ContractWithExtension>;
  consumedByContract: Map<number, number>;
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
      const [
        persons,
        nonBillableSourceMappings,
        clientMappings,
        personRoles,
        squadMemberships,
        existingHourRecords,
        allContracts,
        consumedRows,
      ] = await Promise.all([
        prisma.person.findMany(),
        prisma.nonBillableSourceMapping.findMany({ where: { source: "jira_na" } }),
        prisma.jiraComponentClientMapping.findMany({ include: { contract: { include: { sow: true } } } }),
        prisma.personRole.findMany(),
        prisma.squadMembership.findMany(),
        prisma.hourRecord.findMany({
          where: { externalRef: { in: allExternalRefs } },
          select: { externalRef: true },
        }),
        prisma.contract.findMany({
          select: {
            id: true,
            assignedHours: true,
            childContract: { select: { id: true, type: true } },
          },
        }),
        prisma.hourRecord.groupBy({
          by: ["contractId"],
          _sum: { hours: true },
          where: { contractId: { not: null } },
        }),
      ]);

      // Build lookup maps
      const personByEmail = new Map(persons.map(p => [p.email, p]));
      const sourceMappingByPrefix = new Map(
        nonBillableSourceMappings.map(m => [m.identifierValue, m]),
      );
      const existingRefs = new Set(existingHourRecords.map(r => r.externalRef));
      const contractById = new Map(
        allContracts.map(c => [c.id, { ...c, assignedHours: parseFloat(c.assignedHours.toString()) }]),
      );
      const consumedByContract = new Map(
        consumedRows
          .filter(r => r.contractId !== null)
          .map(r => [r.contractId!, parseFloat((r._sum.hours ?? 0).toString())]),
      );

      const ctx: WorklogLookupContext = {
        personByEmail,
        sourceMappingByPrefix,
        clientMappings,
        personRoles,
        squadMemberships,
        existingRefs,
        contractById,
        consumedByContract,
      };

      await this.processWorklogs(issues, ctx, result);

      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          completedAt: new Date(),
          recordsFetched: result.created + result.skipped,
          recordsCreated: result.created,
          recordsSkipped: result.skipped,
        },
      });
    } catch (err) {
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { completedAt: new Date() },
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

          const squadMembership = ctx.squadMemberships.find(
            sm =>
              sm.personId === person.id &&
              sm.effectiveFrom <= date &&
              (sm.effectiveTo === null || sm.effectiveTo >= date),
          );

          if (!squadMembership) {
            result.skipped++;
            continue; 
          }

          if (isNonBillable) {
            const sourceMapping = ctx.sourceMappingByPrefix.get(issue.key);
            if (!sourceMapping) {
              result.skipped++;
              continue;
            }
            hourRecordsToCreate.push({
              personId: person.id,
              squadId: squadMembership.squadId,
              clientId: null,
              date,
              hours,
              roleType: null,
              source: "jira_na" as const,
              isNonBillable: true,
              nonBillableCategoryId: sourceMapping.categoryId,
              externalRef,
              issueKey: issue.key,
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

          // Route to extension contract if base has exhausted its assignedHours
          const baseContractId = clientMapping.contractId;
          let contractId = baseContractId;
          const baseContract = ctx.contractById.get(baseContractId);
          if (baseContract?.childContract?.type === "extension") {
            const consumed = ctx.consumedByContract.get(baseContractId) ?? 0;
            if (consumed >= baseContract.assignedHours) {
              contractId = baseContract.childContract.id;
            }
          }

          hourRecordsToCreate.push({
            personId: person.id,
            squadId: squadMembership.squadId,
            clientId: clientMapping.contract.sow.clientId,
            date,
            hours,
            roleType: role.roleType,
            source: "jira_na" as const,
            externalRef,
            issueKey: issue.key,
            contractId,
          });
          result.created++;
        } catch (err) {
          result.errors.push(String(err));
        }
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < hourRecordsToCreate.length; i += BATCH_SIZE) {
      await prisma.hourRecord.createMany({
        data: hourRecordsToCreate.slice(i, i + BATCH_SIZE),
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
