import prisma from "../prisma";
import { toUtcDateOnly } from "../temporal";
import { upsertAnomaly } from "../analytics/refresh";
import type { Prisma, Person, NonBillableSourceMapping, PersonRole, SquadMembership } from "@prisma/client";

type JiraMappingWithContract = {
  id: number; jiraInstance: string; componentKey: string; contractId: number;
  effectiveFrom: Date; effectiveTo: Date | null;
  contract: {
    status: string;
    endDate: Date | null;
    sow: { clientId: number; endDate: Date | null; client: { isActive: boolean } };
  };
};

type ContractWithExtension = {
  id: number;
  assignedHours: number;
  childContracts: { id: number; type: string }[] | null;
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
  missingMembership: number;
  missingRole: number;
  missingMapping: number;
  missingDeclaration: number;
  inactiveTarget: number;
  errors: string[];
}

interface ConflictRecord {
  externalRef: string;
  category: "missing_mapping" | "missing_membership" | "missing_role" | "missing_declaration" | "inactive_target";
  authorEmail: string | null;
  issueKey: string;
  componentKey: string | null;
  date: Date;
  hours: number;
  detail: string;
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
  // BR-10: contract+month -> squad, from MonthlyRoleDeclaration
  declarationSquadByContractMonth: Map<string, number>;
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
    const result: SyncResult = {
      created: 0,
      skipped: 0,
      missingMembership: 0,
      missingRole: 0,
      missingMapping: 0,
      missingDeclaration: 0,
      inactiveTarget: 0,
      errors: [],
    };
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
        declarations,
      ] = await Promise.all([
        prisma.person.findMany(),
        prisma.nonBillableSourceMapping.findMany({ where: { source: "jira_na" } }),
        prisma.jiraComponentClientMapping.findMany({
          include: { contract: { include: { sow: { include: { client: true } } } } },
          orderBy: { effectiveFrom: "desc" },
        }),
        prisma.personRole.findMany({ orderBy: { effectiveFrom: "desc" } }),
        prisma.squadMembership.findMany({ orderBy: { effectiveFrom: "desc" } }),
        prisma.hourRecord.findMany({
          where: { externalRef: { in: allExternalRefs } },
          select: { externalRef: true },
        }),
        prisma.contract.findMany({
          select: {
            id: true,
            assignedHours: true,
            childContracts: { select: { id: true, type: true } },
          },
        }),
        prisma.hourRecord.groupBy({
          by: ["contractId"],
          _sum: { hours: true },
          where: { contractId: { not: null } },
        }),
        prisma.monthlyRoleDeclaration.findMany({
          where: {
            contractId: { not: null },
            month: {
              gte: new Date(Date.UTC(new Date(dateFrom).getUTCFullYear(), new Date(dateFrom).getUTCMonth(), 1)),
              lte: new Date(Date.UTC(new Date(dateTo).getUTCFullYear(), new Date(dateTo).getUTCMonth(), 1)),
            },
          },
          select: { contractId: true, squadId: true, month: true },
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
      // One squad per contract per month is guaranteed by @@unique([contractId, month]).
      const declarationSquadByContractMonth = new Map(
        declarations.map(d => [`${d.contractId}:${d.month.toISOString().slice(0, 7)}`, d.squadId]),
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
        declarationSquadByContractMonth,
      };

      await this.processWorklogs(issues, ctx, result);

      const conflicted =
        result.missingMembership + result.missingRole + result.missingMapping +
        result.missingDeclaration + result.inactiveTarget;
      await prisma.syncLog.update({
        where: { id: log.id },
        data: {
          completedAt: new Date(),
          recordsFetched: result.created + result.skipped + conflicted,
          recordsCreated: result.created,
          recordsSkipped: result.skipped,
          recordsConflicted: conflicted,
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
    // one auditable row per skipped worklog, upserted by externalRef
    const conflictsToRecord: ConflictRecord[] = [];
    // client+month pairs that need a missing_data flag (BR-10 fallback)
    const missingDeclarationFlags = new Map<string, Date>();
    // client+month pairs where worklogs targeted a closed/expired entity
    const inactiveTargetFlags = new Map<string, Date>();

    for (const issue of issues) {
      for (const wl of issue.worklogs ?? []) {
        try {
          const externalRef = `jira_na:${wl.id}`;
          if (ctx.existingRefs.has(externalRef)) {
            result.skipped++;
            continue;
          }

          // Normalize to UTC date-only: effectiveFrom/effectiveTo are @db.Date (midnight UTC),
          // so a timestamp with time-of-day would wrongly exclude the final effective day.
          const date = toUtcDateOnly(wl.started);
          const hours = wl.timeSpentSeconds / 3600;
          const components = issue.fields.components ?? [];
          const isNonBillable = ctx.sourceMappingByPrefix.has(issue.key);

          const person = ctx.personByEmail.get(wl.author.emailAddress);
          if (!person) {
            result.missingMapping++;
            conflictsToRecord.push({
              externalRef, category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: components[0]?.name ?? null, date, hours,
              detail: `No person found with email ${wl.author.emailAddress}.`,
            });
            continue;
          }

          const activeMemberships = ctx.squadMemberships.filter(
            sm =>
              sm.personId === person.id &&
              sm.effectiveFrom <= date &&
              (sm.effectiveTo === null || sm.effectiveTo >= date),
          );

          if (activeMemberships.length === 0) {
            result.missingMembership++;
            conflictsToRecord.push({
              externalRef, category: "missing_membership",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: components[0]?.name ?? null, date, hours,
              detail: `No active squad membership on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          if (isNonBillable) {
            const sourceMapping = ctx.sourceMappingByPrefix.get(issue.key);
            if (!sourceMapping) {
              result.missingMapping++;
              conflictsToRecord.push({
                externalRef, category: "missing_mapping",
                authorEmail: wl.author.emailAddress ?? null,
                issueKey: issue.key, componentKey: components[0]?.name ?? null, date, hours,
                detail: `No non-billable source mapping for issue ${issue.key}.`,
              });
              continue;
            }
            // Snapshot the role effective on the worklog date so nb-hours-by-role
            // can group by the stored roleType; null is allowed for NB records.
            const nbRole = ctx.personRoles.find(
              r =>
                r.personId === person.id &&
                r.effectiveFrom <= date &&
                (r.effectiveTo === null || r.effectiveTo >= date),
            );
            if (!nbRole) result.missingRole++;
            // NB worklogs carry no contract, so BR-10's declaration resolution
            // does not apply; most-recently-started membership wins.
            hourRecordsToCreate.push({
              personId: person.id,
              squadId: activeMemberships[0].squadId,
              clientId: null,
              date,
              hours,
              roleType: nbRole?.roleType ?? null,
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
            result.missingMapping++;
            conflictsToRecord.push({
              externalRef, category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: null, date, hours,
              detail: `Worklog issue ${issue.key} has no Jira component.`,
            });
            continue;
          }

          const clientMapping = ctx.clientMappings.find(
            m =>
              m.componentKey === componentName &&
              m.effectiveFrom <= date &&
              (m.effectiveTo === null || m.effectiveTo >= date),
          );
          if (!clientMapping) {
            result.missingMapping++;
            conflictsToRecord.push({
              externalRef, category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: componentName, date, hours,
              detail: `No client mapping for component "${componentName}" effective on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          // BR-5/BR-6: never route hours to a closed/expired contract, an
          // expired SOW, or an archived client. endDate is inclusive — a
          // worklog ON the end date is still valid.
          const mappedContract = clientMapping.contract;
          if (
            mappedContract.status !== "active" ||
            (mappedContract.endDate !== null && date > mappedContract.endDate) ||
            (mappedContract.sow.endDate !== null && date > mappedContract.sow.endDate) ||
            !mappedContract.sow.client.isActive
          ) {
            result.inactiveTarget++;
            conflictsToRecord.push({
              externalRef, category: "inactive_target",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: componentName, date, hours,
              detail: `Mapped contract ${clientMapping.contractId} is closed/expired, its SOW has ended, or the client is archived.`,
            });
            const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            inactiveTargetFlags.set(
              `${mappedContract.sow.clientId}:${month.toISOString().slice(0, 7)}`,
              month,
            );
            continue;
          }

          const role = ctx.personRoles.find(
            r =>
              r.personId === person.id &&
              r.effectiveFrom <= date &&
              (r.effectiveTo === null || r.effectiveTo >= date),
          );
          if (!role) {
            result.missingRole++;
            conflictsToRecord.push({
              externalRef, category: "missing_role",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key, componentKey: componentName, date, hours,
              detail: `No active person role on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          // Route to extension contract if base has exhausted its assignedHours
          const baseContractId = clientMapping.contractId;
          let contractId = baseContractId;
          const baseContract = ctx.contractById.get(baseContractId);
          if (baseContract?.childContracts?.[0]?.type === "extension") {
            const consumed = ctx.consumedByContract.get(baseContractId) ?? 0;
            if (consumed >= baseContract.assignedHours) {
              contractId = baseContract.childContracts[0].id;
            }
          }

          // BR-10: with multiple active memberships, the squad comes from the
          // month's role declaration on the (base) contract. Declarations are
          // written per base contract, so extension rollover does not change
          // the lookup key. No declaration, or a declared squad the person has
          // no membership in, means the record cannot be attributed safely —
          // skip it, count it as a conflict, and flag the client+month.
          let squadId = activeMemberships[0].squadId;
          if (activeMemberships.length > 1) {
            const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            const declaredSquadId = ctx.declarationSquadByContractMonth.get(
              `${baseContractId}:${month.toISOString().slice(0, 7)}`,
            );
            const declaredMembership = declaredSquadId === undefined
              ? undefined
              : activeMemberships.find(sm => sm.squadId === declaredSquadId);
            if (declaredSquadId === undefined || !declaredMembership) {
              result.missingDeclaration++;
              conflictsToRecord.push({
                externalRef, category: "missing_declaration",
                authorEmail: wl.author.emailAddress ?? null,
                issueKey: issue.key, componentKey: componentName, date, hours,
                detail: `Person has multiple active squad memberships and no role declaration for contract ${baseContractId} in ${month.toISOString().slice(0, 7)} resolves a squad they belong to.`,
              });
              missingDeclarationFlags.set(
                `${clientMapping.contract.sow.clientId}:${month.toISOString().slice(0, 7)}`,
                month,
              );
              continue;
            }
            squadId = declaredSquadId;
          }

          hourRecordsToCreate.push({
            personId: person.id,
            squadId,
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

    // Persist one auditable row per conflicted worklog. Upsert by externalRef so
    // re-syncs refresh lastSeenAt instead of duplicating.
    const now = new Date();
    for (const c of conflictsToRecord) {
      await prisma.syncConflict.upsert({
        where: { externalRef: c.externalRef },
        update: {
          category: c.category, authorEmail: c.authorEmail, issueKey: c.issueKey,
          componentKey: c.componentKey, date: c.date, hours: c.hours,
          detail: c.detail, lastSeenAt: now,
        },
        create: { ...c, source: "jira_na", lastSeenAt: now },
      });
    }
    // Clear conflicts for worklogs that imported this run (e.g. person added or
    // declaration created since the previous sync).
    const createdRefs = hourRecordsToCreate
      .map(r => r.externalRef)
      .filter((r): r is string => typeof r === "string");
    if (createdRefs.length > 0) {
      await prisma.syncConflict.deleteMany({ where: { externalRef: { in: createdRefs } } });
    }

    for (const [key, month] of missingDeclarationFlags) {
      await upsertAnomaly(
        Number(key.split(":")[0]),
        month,
        null,
        "missing_data",
        "high",
        "Worklog(s) skipped: person has multiple active squad memberships and no role declaration resolves the contract's squad for this month. Create the declaration and re-sync.",
      );
    }
    for (const [key, month] of inactiveTargetFlags) {
      await upsertAnomaly(
        Number(key.split(":")[0]),
        month,
        null,
        "missing_data",
        "high",
        "Worklog(s) skipped: the mapped contract is closed/expired, its SOW has ended, or the client is archived. Renew or remap the component, then re-sync.",
      );
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
