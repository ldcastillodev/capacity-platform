import {
  syncService,
  personService,
  nonBillableService,
  componentMappingService,
  squadService,
  hourRecordService,
  contractService,
  declarationService,
  reconciliationService,
} from "../db";
import pLimit from "p-limit";
import { addUtcDays, toUtcDateOnly } from "../temporal";
import { upsertAnomaly } from "../analytics/refresh";
import type {
  Prisma,
  Person,
  NonBillableSourceMapping,
  PersonRole,
  SquadMembership,
  SyncSource,
} from "@prisma/client";
import { JIRA_INSTANCES } from "../constants";

// A contract closed by renewal/expiry still accepts a backdated, in-window
// worklog, but only while seen within this many days of the close boundary — so a
// long-closed contract cannot silently absorb new hours.
const GRACE_PERIOD_DAYS = 14;

type JiraMappingWithContract = {
  id: number;
  jiraInstance: string;
  componentKey: string;
  contractId: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  contract: {
    name: string;
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
  author: { accountId: string; emailAddress: string };
  started: string;
  timeSpentSeconds: number;
  comment?: { content?: Array<{ content?: Array<{ text?: string }> }> };
}

interface JiraIssue {
  key: string;
  fields: {
    components?: Array<{ name: string }>;
    issuetype?: { name: string };
    worklog?: { total: number; maxResults: number; worklogs: JiraWorklog[] };
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
  // Reconciliation (post-create drift correction against current Jira state)
  reconcileUpdated: number;
  reconcileArchived: number;
  reconcileSkipped: number;
  reconcileFailed: number;
  errors: string[];
}

interface ConflictRecord {
  externalRef: string;
  category:
    | "missing_mapping"
    | "missing_membership"
    | "missing_role"
    | "missing_declaration"
    | "inactive_target";
  authorEmail: string | null;
  issueKey: string;
  componentKey: string | null;
  date: Date;
  hours: number;
  detail: string;
}

interface WorklogLookupContext {
  personByEmail: Map<string, Person>;
  // NB classification: issue_key mappings keyed by issue key, component_key mappings by component name
  nbMappingByIssueKey: Map<string, NonBillableSourceMapping>;
  nbMappingByComponent: Map<string, NonBillableSourceMapping>;
  // Pre-indexed for O(1) per-worklog lookups (insertion order preserved so
  // first-match / [0] semantics are identical to the prior linear scans).
  mappingsByComponent: Map<string, JiraMappingWithContract[]>;
  rolesByPerson: Map<number, PersonRole[]>;
  membershipsByPerson: Map<number, SquadMembership[]>;
  existingRefs: Set<string | null>;
  contractById: Map<number, ContractWithExtension>;
  consumedByContract: Map<number, number>;
  // BR-10: contract+month -> squad, from MonthlyRoleDeclaration
  declarationSquadByContractMonth: Map<string, number>;
}

export interface JiraConnectorConfig {
  baseUrl: string;
  email: string;
  token: string;
  /** SyncSource written on HourRecord/SyncLog/SyncConflict and externalRef prefix */
  source: SyncSource;
  /** jiraInstance code used to scope component/source mapping lookups */
  instance: string;
}

/** Resolve a source's credentials + codes from env, via the JIRA_INSTANCES registry. */
export function jiraConfigForSource(source: SyncSource): JiraConnectorConfig {
  const inst = JIRA_INSTANCES.find((i) => i.source === source);
  if (!inst) throw new Error(`Unknown Jira source: ${source}`);
  return {
    baseUrl: process.env[`${inst.envPrefix}_BASE_URL`] ?? "",
    email: process.env[`${inst.envPrefix}_EMAIL`] ?? "",
    token: process.env[`${inst.envPrefix}_API_TOKEN`] ?? "",
    source: inst.source,
    instance: inst.value,
  };
}

export class JiraConnector {
  private baseUrl: string;
  private email: string;
  private token: string;
  private source: SyncSource;
  private instance: string;

  constructor(config: JiraConnectorConfig) {
    this.baseUrl = config.baseUrl;
    this.email = config.email;
    this.token = config.token;
    this.source = config.source;
    this.instance = config.instance;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.email}:${this.token}`).toString("base64")}`;
  }

  async sync(dateFrom: string, dateTo: string): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      skipped: 0,
      missingMembership: 0,
      missingRole: 0,
      missingMapping: 0,
      missingDeclaration: 0,
      inactiveTarget: 0,
      reconcileUpdated: 0,
      reconcileArchived: 0,
      reconcileSkipped: 0,
      reconcileFailed: 0,
      errors: [],
    };
    const log = await syncService.createSyncLog({
      source: this.source,
      startedAt: new Date(),
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
    });

    try {
      // Issue-independent lookups first — these also drive the JQL filter, so we
      // fetch them before hitting Jira (eliminates the duplicate source-mapping
      // and component-mapping queries the fetch method used to make).
      const [
        persons,
        nonBillableSourceMappings,
        clientMappings,
        personRoles,
        squadMemberships,
        allContracts,
        consumedRows,
        declarations,
      ] = await Promise.all([
        personService.listPersonsForSync(),
        nonBillableService.listSourceMappingsForSync(this.source),
        componentMappingService.listMappingsWithContractForSync(this.instance),
        personService.listPersonRolesForSync(),
        squadService.listMembershipsForSync(),
        contractService.listContractsForSync(),
        hourRecordService.sumLifetimeBillableHoursByContract(),
        declarationService.listDeclarationsForSync(
          new Date(
            Date.UTC(new Date(dateFrom).getUTCFullYear(), new Date(dateFrom).getUTCMonth(), 1)
          ),
          new Date(Date.UTC(new Date(dateTo).getUTCFullYear(), new Date(dateTo).getUTCMonth(), 1))
        ),
      ]);

      // JQL filters derived from already-fetched data (no extra DB round trips).
      const nbIssueMappings = nonBillableSourceMappings.filter(
        (m) => m.identifierType === "issue_key"
      );
      const nbComponentMappings = nonBillableSourceMappings.filter(
        (m) => m.identifierType === "component_key"
      );
      const nonBillableTicketKeys = nbIssueMappings.map((m) => m.identifierValue);
      const componentKeys = [
        ...new Set([
          ...clientMappings.map((m) => m.componentKey),
          ...nbComponentMappings.map((m) => m.identifierValue),
        ]),
      ];

      const issues = await this.fetchIssuesWithWorklogs(
        dateFrom,
        dateTo,
        nonBillableTicketKeys,
        componentKeys
      );

      // Collect all externalRefs upfront for batch existence check
      const allExternalRefs: string[] = [];
      for (const issue of issues) {
        for (const wl of issue.worklogs ?? []) {
          allExternalRefs.push(`${this.source}:${wl.id}`);
        }
      }

      const existingHourRecords =
        await hourRecordService.listExistingHourRecordRefs(allExternalRefs);

      // Build lookup maps
      const personByEmail = new Map(persons.map((p) => [p.email, p]));
      const nbMappingByIssueKey = new Map(nbIssueMappings.map((m) => [m.identifierValue, m]));
      const nbMappingByComponent = new Map(nbComponentMappings.map((m) => [m.identifierValue, m]));
      const existingRefs = new Set(existingHourRecords.map((r) => r.externalRef));

      // Pre-index per-worklog lookups (preserve source order within each group).
      const mappingsByComponent = new Map<string, JiraMappingWithContract[]>();
      for (const m of clientMappings) {
        const list = mappingsByComponent.get(m.componentKey);
        if (list) list.push(m);
        else mappingsByComponent.set(m.componentKey, [m]);
      }
      const rolesByPerson = new Map<number, PersonRole[]>();
      for (const r of personRoles) {
        const list = rolesByPerson.get(r.personId);
        if (list) list.push(r);
        else rolesByPerson.set(r.personId, [r]);
      }
      const membershipsByPerson = new Map<number, SquadMembership[]>();
      for (const sm of squadMemberships) {
        const list = membershipsByPerson.get(sm.personId);
        if (list) list.push(sm);
        else membershipsByPerson.set(sm.personId, [sm]);
      }
      const contractById = new Map(
        allContracts.map((c) => [
          c.id,
          { ...c, assignedHours: parseFloat(c.assignedHours.toString()) },
        ])
      );
      const consumedByContract = new Map(
        consumedRows
          .filter((r) => r.contractId !== null)
          .map((r) => [r.contractId!, parseFloat((r._sum.hours ?? 0).toString())])
      );
      // One squad per contract per month is guaranteed by @@unique([contractId, month]).
      const declarationSquadByContractMonth = new Map(
        declarations.map((d) => [`${d.contractId}:${d.month.toISOString().slice(0, 7)}`, d.squadId])
      );

      const ctx: WorklogLookupContext = {
        personByEmail,
        nbMappingByIssueKey,
        nbMappingByComponent,
        mappingsByComponent,
        rolesByPerson,
        membershipsByPerson,
        existingRefs,
        contractById,
        consumedByContract,
        declarationSquadByContractMonth,
      };

      await this.processWorklogs(issues, ctx, result);

      // Reconcile existing rows against the worklogs we just fetched: correct
      // hours drift and soft-delete rows whose worklog was deleted in Jira.
      // Runs in the same sequential sync, scoped to this source.
      await this.reconcile(issues, new Date(dateFrom), new Date(dateTo), result);

      const conflicted =
        result.missingMembership +
        result.missingRole +
        result.missingMapping +
        result.missingDeclaration +
        result.inactiveTarget;
      await syncService.updateSyncLog(log.id, {
        completedAt: new Date(),
        success: true,
        recordsFetched: result.created + result.skipped + conflicted,
        recordsCreated: result.created,
        recordsSkipped: result.skipped,
        recordsConflicted: conflicted,
      });
    } catch (err) {
      await syncService.updateSyncLog(log.id, { completedAt: new Date() });
      throw err;
    }

    return result;
  }

  private async processWorklogs(
    issues: JiraIssue[],
    ctx: WorklogLookupContext,
    result: SyncResult
  ): Promise<void> {
    const hourRecordsToCreate: Prisma.HourRecordCreateManyInput[] = [];
    // one auditable row per skipped worklog, upserted by externalRef
    const conflictsToRecord: ConflictRecord[] = [];
    // client+month pairs that need a missing_data flag (BR-10 fallback)
    const missingDeclarationFlags = new Map<string, { month: Date; entries: Set<string> }>();
    // client+month pairs where worklogs targeted a closed/expired entity
    const inactiveTargetFlags = new Map<string, Date>();
    const today = toUtcDateOnly(new Date());
    // Gap B: decide base-vs-extension against a tally that grows during this run,
    // not the stale pre-sync snapshot. Seeded from lifetime consumed per base contract.
    const runningConsumed = new Map(ctx.consumedByContract);

    // Gap B: process in ascending logged-date order so a single run crossing a base
    // contract's assignedHours threshold rolls boundary worklogs to the extension.
    const worklogItems = issues.flatMap((issue) =>
      (issue.worklogs ?? []).map((wl) => ({ issue, wl }))
    );
    worklogItems.sort(
      (a, b) => toUtcDateOnly(a.wl.started).getTime() - toUtcDateOnly(b.wl.started).getTime()
    );

    for (const { issue, wl } of worklogItems) {
      {
        try {
          const externalRef = `${this.source}:${wl.id}`;
          if (ctx.existingRefs.has(externalRef)) {
            result.skipped++;
            continue;
          }

          // Normalize to UTC date-only: effectiveFrom/effectiveTo are @db.Date (midnight UTC),
          // so a timestamp with time-of-day would wrongly exclude the final effective day.
          const date = toUtcDateOnly(wl.started);
          const hours = wl.timeSpentSeconds / 3600;
          const components = issue.fields.components ?? [];
          // issue_key match takes precedence; otherwise first component matching an NB
          // component mapping. NB classification wins over billable component mappings.
          const nbComponentMatch = components.find((c) => ctx.nbMappingByComponent.has(c.name));
          const isNonBillable = ctx.nbMappingByIssueKey.has(issue.key) || !!nbComponentMatch;

          const person = ctx.personByEmail.get(wl.author.emailAddress);
          if (!person) {
            result.missingMapping++;
            conflictsToRecord.push({
              externalRef,
              category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: components[0]?.name ?? null,
              date,
              hours,
              detail: `Unrecognized person — no Person record matches Jira author ${
                wl.author.emailAddress ?? `accountId ${wl.author.accountId}`
              }. Add them in Management and re-sync to import these hours.`,
            });
            continue;
          }

          const activeMemberships = (ctx.membershipsByPerson.get(person.id) ?? []).filter(
            (sm) => sm.effectiveFrom <= date && (sm.effectiveTo === null || sm.effectiveTo >= date)
          );

          if (activeMemberships.length === 0) {
            result.missingMembership++;
            conflictsToRecord.push({
              externalRef,
              category: "missing_membership",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: components[0]?.name ?? null,
              date,
              hours,
              detail: `No active squad membership on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          if (isNonBillable) {
            const sourceMapping =
              ctx.nbMappingByIssueKey.get(issue.key) ??
              (nbComponentMatch ? ctx.nbMappingByComponent.get(nbComponentMatch.name) : undefined);
            if (!sourceMapping) {
              result.missingMapping++;
              conflictsToRecord.push({
                externalRef,
                category: "missing_mapping",
                authorEmail: wl.author.emailAddress ?? null,
                issueKey: issue.key,
                componentKey: components[0]?.name ?? null,
                date,
                hours,
                detail: `No non-billable source mapping for issue ${issue.key}.`,
              });
              continue;
            }
            // Snapshot the role effective on the worklog date so nb-hours-by-role
            // can group by the stored roleType; null is allowed for NB records.
            const nbRole = (ctx.rolesByPerson.get(person.id) ?? []).find(
              (r) => r.effectiveFrom <= date && (r.effectiveTo === null || r.effectiveTo >= date)
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
              source: this.source,
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
              externalRef,
              category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: null,
              date,
              hours,
              detail: `Worklog issue ${issue.key} has no Jira component.`,
            });
            continue;
          }

          const clientMapping = (ctx.mappingsByComponent.get(componentName) ?? []).find(
            (m) => m.effectiveFrom <= date && (m.effectiveTo === null || m.effectiveTo >= date)
          );
          if (!clientMapping) {
            result.missingMapping++;
            conflictsToRecord.push({
              externalRef,
              category: "missing_mapping",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: componentName,
              date,
              hours,
              detail: `No client mapping for component "${componentName}" effective on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          // BR-5/BR-6: never route hours to a closed/expired contract, an
          // expired SOW, or an archived client. endDate is inclusive — a
          // worklog ON the end date is still valid.
          const mappedContract = clientMapping.contract;
          // Gap A: a closed contract still accepts a backdated, in-window worklog,
          // but only within a grace window after its close boundary. The boundary is
          // the contract endDate, falling back to the mapping's effectiveTo (the
          // renewal/close cutover) when the closed contract is open-ended. With no
          // boundary at all, reject (safe default).
          const closeAnchor = mappedContract.endDate ?? clientMapping.effectiveTo;
          const pastGrace =
            closeAnchor === null || today > addUtcDays(closeAnchor, GRACE_PERIOD_DAYS);
          if (
            (mappedContract.status !== "active" && pastGrace) ||
            (mappedContract.endDate !== null && date > mappedContract.endDate) ||
            (mappedContract.sow.endDate !== null && date > mappedContract.sow.endDate) ||
            !mappedContract.sow.client.isActive
          ) {
            result.inactiveTarget++;
            conflictsToRecord.push({
              externalRef,
              category: "inactive_target",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: componentName,
              date,
              hours,
              detail: `Mapped contract ${clientMapping.contractId} is closed/expired, its SOW has ended, or the client is archived.`,
            });
            const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            inactiveTargetFlags.set(
              `${mappedContract.sow.clientId}:${month.toISOString().slice(0, 7)}`,
              month
            );
            continue;
          }

          const role = (ctx.rolesByPerson.get(person.id) ?? []).find(
            (r) => r.effectiveFrom <= date && (r.effectiveTo === null || r.effectiveTo >= date)
          );
          if (!role) {
            result.missingRole++;
            conflictsToRecord.push({
              externalRef,
              category: "missing_role",
              authorEmail: wl.author.emailAddress ?? null,
              issueKey: issue.key,
              componentKey: componentName,
              date,
              hours,
              detail: `No active person role on ${date.toISOString().slice(0, 10)}.`,
            });
            continue;
          }

          // Route hours between the base contract and its extension. Worklogs
          // fill the base up to assignedHours, then spill into the extension. A
          // worklog straddling the boundary is split so the base lands on
          // exactly assignedHours and only the remainder rolls to the extension.
          const baseContractId = clientMapping.contractId;
          const baseContract = ctx.contractById.get(baseContractId);
          const consumed = runningConsumed.get(baseContractId) ?? 0;
          const extensionChild = baseContract?.childContracts?.find((c) => c.type === "extension");
          let baseHours = hours;
          let extHours = 0;
          if (extensionChild) {
            const remaining = Math.max(baseContract!.assignedHours - consumed, 0);
            baseHours = Math.min(hours, remaining);
            extHours = hours - baseHours;
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
              `${baseContractId}:${month.toISOString().slice(0, 7)}`
            );
            const declaredMembership =
              declaredSquadId === undefined
                ? undefined
                : activeMemberships.find((sm) => sm.squadId === declaredSquadId);
            if (declaredSquadId === undefined || !declaredMembership) {
              result.missingDeclaration++;
              conflictsToRecord.push({
                externalRef,
                category: "missing_declaration",
                authorEmail: wl.author.emailAddress ?? null,
                issueKey: issue.key,
                componentKey: componentName,
                date,
                hours,
                detail: `${person.name} has multiple active squad memberships and no role declaration for contract "${clientMapping.contract.name}" (#${baseContractId}) in ${month.toISOString().slice(0, 7)} resolves a squad they belong to.`,
              });
              const flagKey = `${clientMapping.contract.sow.clientId}:${month.toISOString().slice(0, 7)}`;
              const flag = missingDeclarationFlags.get(flagKey) ?? {
                month,
                entries: new Set<string>(),
              };
              flag.entries.add(`${person.name} → "${clientMapping.contract.name}"`);
              missingDeclarationFlags.set(flagKey, flag);
              continue;
            }
            squadId = declaredSquadId;
          }

          // A split keeps the plain base ref on the base portion and a `:ext`
          // suffix on the extension portion. A worklog landing wholly on one
          // contract keeps the plain base ref so the skip check (line ~300)
          // short-circuits re-syncs; createMany(skipDuplicates) is the backstop.
          const common = {
            personId: person.id,
            squadId,
            clientId: clientMapping.contract.sow.clientId,
            date,
            roleType: role.roleType,
            source: this.source,
            issueKey: issue.key,
          };
          if (baseHours > 0) {
            hourRecordsToCreate.push({
              ...common,
              hours: baseHours,
              externalRef,
              contractId: baseContractId,
            });
          }
          if (extHours > 0) {
            hourRecordsToCreate.push({
              ...common,
              hours: extHours,
              externalRef: baseHours > 0 ? `${externalRef}:ext` : externalRef,
              contractId: extensionChild!.id,
            });
          }
          // Gap B: grow the per-base tally so later same-run worklogs roll to the
          // extension once the base's assignedHours are crossed. Keyed on the base
          // (not the routed contract) and monotonic — it only drives the threshold.
          runningConsumed.set(baseContractId, consumed + hours);
          result.created++;
        } catch (err) {
          result.errors.push(String(err));
        }
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < hourRecordsToCreate.length; i += BATCH_SIZE) {
      await hourRecordService.createHourRecordsBatch(hourRecordsToCreate.slice(i, i + BATCH_SIZE));
    }

    // Persist one auditable row per conflicted worklog. Upsert by externalRef so
    // re-syncs refresh lastSeenAt instead of duplicating.
    const now = new Date();
    if (conflictsToRecord.length > 0) {
      await syncService.upsertSyncConflictsBatch(
        conflictsToRecord.map((c) => ({
          externalRef: c.externalRef,
          update: {
            category: c.category,
            authorEmail: c.authorEmail,
            issueKey: c.issueKey,
            componentKey: c.componentKey,
            date: c.date,
            hours: c.hours,
            detail: c.detail,
            lastSeenAt: now,
          },
          create: { ...c, source: this.source, lastSeenAt: now },
        }))
      );
    }
    // Clear conflicts for worklogs that imported this run (e.g. person added or
    // declaration created since the previous sync).
    const createdRefs = hourRecordsToCreate
      .map((r) => r.externalRef)
      .filter((r): r is string => typeof r === "string");
    if (createdRefs.length > 0) {
      await syncService.deleteSyncConflictsByRefs(createdRefs);
    }

    await Promise.all([
      ...[...missingDeclarationFlags].map(([key, { month, entries }]) =>
        upsertAnomaly(
          Number(key.split(":")[0]),
          month,
          null,
          "missing_data",
          "high",
          `Worklog(s) skipped — multiple active squad memberships and no role declaration resolves the contract's squad for this month: ${[...entries].join("; ")}. Create the declaration(s) and re-sync.`
        )
      ),
      ...[...inactiveTargetFlags].map(([key, month]) =>
        upsertAnomaly(
          Number(key.split(":")[0]),
          month,
          null,
          "missing_data",
          "high",
          "Worklog(s) skipped: the mapped contract is closed/expired, its SOW has ended, or the client is archived. Renew or remap the component, then re-sync."
        )
      ),
    ]);
  }

  /**
   * Reconcile persisted HourRecords against the worklogs fetched this run.
   *
   * For each in-window worklog this source previously imported:
   *  - hours changed in Jira  → update the row's hours in place (snapshot kept);
   *    a worklog zeroed in Jira is soft-deleted (effective delete).
   *  - worklog absent from the fetch → confirm with a per-worklog GET: a 404
   *    soft-deletes the row(s); a 200 is treated as drift; a network/5xx error
   *    is ambiguous, so the row is left untouched and only counted.
   *
   * A worklog split across a base + extension contract cannot have its hours
   * re-applied without re-splitting (which would recompute attribution), so its
   * drift is flagged for manual review instead of auto-applied.
   */
  private async reconcile(
    issues: JiraIssue[],
    dateFrom: Date,
    dateTo: Date,
    result: SyncResult
  ): Promise<void> {
    // Hours currently present in Jira for each in-window worklog id.
    const presentHoursById = new Map<string, number>();
    for (const issue of issues) {
      for (const wl of issue.worklogs ?? []) {
        presentHoursById.set(
          wl.id,
          (presentHoursById.get(wl.id) ?? 0) + wl.timeSpentSeconds / 3600
        );
      }
    }

    const rows = await reconciliationService.listReconcilableHourRecords(
      this.source,
      dateFrom,
      dateTo
    );

    // Group rows by base Jira worklog id. A split worklog has a base row
    // (`source:id`) and an extension row (`source:id:ext`); both must move
    // together. Refs not prefixed with this source are skipped (isolation).
    const prefix = `${this.source}:`;
    type Group = {
      worklogId: string;
      issueKey: string | null;
      clientId: number | null;
      date: Date;
      rows: { id: number; hours: number }[];
    };
    const groups = new Map<string, Group>();
    for (const r of rows) {
      if (!r.externalRef.startsWith(prefix)) continue;
      const rest = r.externalRef.slice(prefix.length);
      const worklogId = rest.endsWith(":ext") ? rest.slice(0, -":ext".length) : rest;
      const g = groups.get(worklogId) ?? {
        worklogId,
        issueKey: r.issueKey,
        clientId: r.clientId,
        date: r.date,
        rows: [],
      };
      g.rows.push({ id: r.id, hours: r.hours });
      groups.set(worklogId, g);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    for (const g of groups.values()) {
      const dbHours = round2(g.rows.reduce((s, x) => s + x.hours, 0));

      if (presentHoursById.has(g.worklogId)) {
        await this.applyDrift(g, round2(presentHoursById.get(g.worklogId)!), dbHours, result);
        continue;
      }

      // Absent from the fetch — confirm before assuming deletion.
      if (!g.issueKey) {
        result.reconcileFailed++; // cannot confirm without an issue key
        continue;
      }
      const status = await this.fetchWorklog(g.issueKey, g.worklogId);
      if (status.state === "deleted") {
        for (const row of g.rows) {
          await reconciliationService.softDeleteHourRecord(row.id, "jira_deleted");
        }
        result.reconcileArchived++;
      } else if (status.state === "present") {
        await this.applyDrift(g, round2(status.hours), dbHours, result);
      } else {
        result.reconcileFailed++; // network/5xx — ambiguous, never delete
      }
    }
  }

  /** Apply hours drift for one worklog group (update / zero-delete / flag split). */
  private async applyDrift(
    g: {
      worklogId: string;
      issueKey: string | null;
      clientId: number | null;
      date: Date;
      rows: { id: number; hours: number }[];
    },
    jiraHours: number,
    dbHours: number,
    result: SyncResult
  ): Promise<void> {
    if (jiraHours === dbHours) return; // no drift

    // A split worklog can't be re-applied as a pure hours update without
    // re-splitting (= recomputing attribution). Flag for manual review.
    if (g.rows.length > 1) {
      result.reconcileSkipped++;
      if (g.clientId !== null) {
        const month = new Date(Date.UTC(g.date.getUTCFullYear(), g.date.getUTCMonth(), 1));
        await upsertAnomaly(
          g.clientId,
          month,
          null,
          "missing_data",
          "medium",
          `Worklog ${g.issueKey ?? ""}#${g.worklogId} hours changed in Jira (${dbHours}h → ${jiraHours}h) but the local record is split across a base + extension contract. Reconcile manually to preserve contract attribution.`
        );
      }
      return;
    }

    if (jiraHours === 0) {
      await reconciliationService.softDeleteHourRecord(g.rows[0].id, "jira_zeroed");
      result.reconcileArchived++;
    } else {
      await reconciliationService.updateHourRecordHours(g.rows[0].id, jiraHours);
      result.reconcileUpdated++;
    }
  }

  /** Fetch a single worklog to disambiguate deleted (404) from present from error. */
  private async fetchWorklog(
    issueKey: string,
    worklogId: string
  ): Promise<{ state: "present"; hours: number } | { state: "deleted" } | { state: "error" }> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, {
        headers: { Authorization: this.authHeader, Accept: "application/json" },
      });
      if (res.status === 404) return { state: "deleted" };
      if (!res.ok) return { state: "error" };
      const wl = (await res.json()) as { timeSpentSeconds: number };
      return { state: "present", hours: wl.timeSpentSeconds / 3600 };
    } catch {
      return { state: "error" };
    }
  }

  private async fetchIssuesWithWorklogs(
    dateFrom: string,
    dateTo: string,
    nonBillableTicketKeys: string[],
    componentKeys: string[]
  ): Promise<JiraIssue[]> {
    const jql = this.generateJql(dateFrom, dateTo, nonBillableTicketKeys, componentKeys);

    const from = new Date(dateFrom).getTime();
    const to = new Date(dateTo).getTime();
    const inRange = (wl: JiraWorklog) => {
      const t = new Date(wl.started).getTime();
      return t >= from && t <= to;
    };

    // Worklogs arrive embedded in the search response; only issues that overflow
    // the embedded page (total > maxResults) need a per-issue follow-up fetch.
    const rawIssues: JiraIssue[] = [];
    const overflowIssues: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    const maxResults = 100;

    while (true) {
      const body: Record<string, unknown> = {
        jql,
        maxResults,
        fields: ["key", "components", "issuetype", "worklog"],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await fetch(`${this.baseUrl}/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Jira search error: ${res.status}`);
      const data = (await res.json()) as {
        issues: JiraIssue[];
        nextPageToken?: string;
        isLast?: boolean;
      };

      for (const issue of data.issues) {
        const embedded = issue.fields.worklog;
        // Trust the embedded set only when it actually contains every worklog
        // (length >= total). The search endpoint can report a large maxResults
        // while returning a truncated worklogs array, so comparing against
        // maxResults would silently drop the missing worklogs.
        const complete =
          embedded != null &&
          Array.isArray(embedded.worklogs) &&
          embedded.worklogs.length >= embedded.total;
        if (complete) {
          rawIssues.push({ ...issue, worklogs: embedded.worklogs.filter(inRange) });
        } else {
          // Incomplete embedded set — fetch the full worklog list separately.
          overflowIssues.push(issue);
        }
      }

      if (data.isLast || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }

    // Overflow issues fetched in parallel with capped concurrency to avoid
    // tripping Jira rate limits; per-issue errors fall back to [] (handled in
    // fetchWorklogs), consistent with prior behavior.
    const limit = pLimit(5);
    const resolvedOverflow = await Promise.all(
      overflowIssues.map((issue) =>
        limit(async () => ({
          ...issue,
          worklogs: await this.fetchWorklogs(issue.key, dateFrom, dateTo),
        }))
      )
    );

    return [...rawIssues, ...resolvedOverflow].filter(
      (issue) => issue.worklogs && issue.worklogs.length > 0
    );
  }

  private async fetchWorklogs(
    issueKey: string,
    dateFrom: string,
    dateTo: string
  ): Promise<JiraWorklog[]> {
    const res = await fetch(`${this.baseUrl}/rest/api/3/issue/${issueKey}/worklog`, {
      headers: { Authorization: this.authHeader, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { worklogs: JiraWorklog[] };
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
      const formattedKeys = ticketKeys.map((key) => `'${key}'`).join(", ");
      optionalClauses.push(`issueKey IN (${formattedKeys})`);
    }

    // Validate and format components
    if (components.length > 0) {
      const formattedComponents = components.map((comp) => `'${comp}'`).join(", ");
      optionalClauses.push(`component IN (${formattedComponents})`);
    }

    // Dynamically join optional clauses
    if (optionalClauses.length > 0) {
      // If both exist, join with OR and wrap in parentheses.
      // If only one exists, leave it without parentheses.
      const internalCondition =
        optionalClauses.length > 1 ? `(${optionalClauses.join(" OR ")})` : optionalClauses[0];

      jql += ` AND ${internalCondition}`;
    }

    return jql;
  }
}
