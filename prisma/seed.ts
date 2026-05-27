import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { runAnalyticsRefresh } from "../src/lib/analytics/refresh";

const prisma = new PrismaClient();

// Current month (analytics refresh computes from today; seed matches)
const today = new Date();
const CUR = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
const PRIOR = new Date(Date.UTC(CUR.getUTCFullYear(), CUR.getUTCMonth() - 1, 1));

function day(month: Date, d: number): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d));
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v));
}

// Load live-DB snapshot captured by prisma/extract-db.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const snapshot: Record<string, any[]> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "db-snapshot.json"), "utf8"),
);

function scrubEmail(email: string): string {
  const local = email.split("@")[0];
  return `${local}@example.com`;
}

// Parse an ISO-string (or null) to Date (or null).
function d(v: string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}

// Parse Decimal/numeric values — Prisma serialises Decimal as string in JSON,
// but $executeRawUnsafe binds them as text; PostgreSQL won't cast text→numeric implicitly.
function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return parseFloat(String(v));
}

// Reset the Postgres auto-increment sequence to MAX(id) after explicit-ID inserts.
async function resetSeq(table: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`,
  );
}

type RawVal = string | number | boolean | Date | null;

// Bulk INSERT via raw SQL with per-column explicit casts (needed for Postgres enum columns —
// parameterised queries bind values as text, so implicit casting from text→enum is rejected).
// casts[i] is the Postgres type name to cast column i to, or null for no cast.
async function bulkInsert(
  table: string,
  cols: string[],
  rows: RawVal[][],
  casts: (string | null)[] = [],
): Promise<void> {
  if (rows.length === 0) return;
  const BATCH = 400; // stay well under Postgres 65535 bind-param limit
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ph = batch
      .map((_, ri) =>
        `(${cols
          .map((_, ci) => {
            const idx = ri * cols.length + ci + 1;
            return casts[ci] ? `$${idx}::${casts[ci]}` : `$${idx}`;
          })
          .join(", ")})`,
      )
      .join(", ");
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${ph}`;
    await prisma.$executeRawUnsafe(sql, ...batch.flat());
  }
}

async function main() {
  const curMonth = CUR.toISOString().substring(0, 7);

  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.nonBillableEnhancementSuggestion.deleteMany(),
    prisma.monthlyCeremonyAllocation.deleteMany(),
    prisma.monthlyNonBillableSummary.deleteMany(),
    prisma.anomalyFlag.deleteMany(),
    prisma.staffingGapSnapshot.deleteMany(),
    prisma.ceremonyAttribution.deleteMany(),
    prisma.monthlyConsumptionSummary.deleteMany(),
    prisma.weeklyBurnSnapshot.deleteMany(),
    prisma.nonBillableEntry.deleteMany(),
    prisma.hourRecord.deleteMany(),
    prisma.syncLog.deleteMany(),
    prisma.monthlyRoleDeclaration.deleteMany(),
    prisma.changeOrderLineItem.deleteMany(),
    prisma.changeOrder.deleteMany(),
    prisma.contractExtension.deleteMany(),
    prisma.billingRate.deleteMany(),
    prisma.costRate.deleteMany(),
    prisma.retainerContract.deleteMany(),
    prisma.clientPersonAccess.deleteMany(),
    prisma.sMEEngagement.deleteMany(),
    prisma.nonBillableSourceMapping.deleteMany(),  // before nonBillableCategory (FK)
    prisma.nonBillableCategory.deleteMany(),
    prisma.personCalendarAssignment.deleteMany(),
    prisma.holidayEntry.deleteMany(),
    prisma.holidayCalendar.deleteMany(),
    prisma.personRole.deleteMany(),
    prisma.squadMembership.deleteMany(),
    prisma.squadCapacityConfig.deleteMany(),
    prisma.clientSimulationLineItem.deleteMany(),
    prisma.clientSimulation.deleteMany(),
    prisma.jiraComponentClientMapping.deleteMany(),
    prisma.tempoAccountClientMapping.deleteMany(),
    prisma.roleCascadeRule.deleteMany(),
    prisma.tEBillingRoleRate.deleteMany(),
    prisma.tEBillingConfig.deleteMany(),
  ]);
  // Clear in order to avoid FK violations
  await prisma.client.deleteMany();
  await prisma.person.deleteMany();
  await prisma.squad.deleteMany();

  console.log("Seeding squads…");
  await bulkInsert(
    "squads",
    ["id", "name", "lead_person_id", "is_active"],
    snapshot.squads.map((s) => [s.id, s.name, s.leadPersonId ?? null, s.isActive]),
  );
  await resetSeq("squads");

  console.log("Seeding people…");
  await bulkInsert(
    "persons",
    ["id", "name", "email", "employment_type", "is_active", "weekly_capacity_hours", "tempo_account_id", "cost_per_hour"],
    snapshot.persons.map((p) => [
      p.id, p.name, scrubEmail(p.email), p.employmentType, p.isActive,
      n(p.weeklyCapacityHours), p.tempoAccountId ?? null, n(p.costPerHour),
    ]),
    [null, null, null, "employmenttype", null, null, null, null],
  );
  await resetSeq("persons");

  console.log("Seeding clients…");
  await bulkInsert(
    "clients",
    ["id", "name", "is_active", "region", "currency"],
    snapshot.clients.map((c) => [c.id, c.name, c.isActive, c.region, c.currency]),
    [null, null, null, "region", "currency"],
  );
  await resetSeq("clients");

  console.log("Seeding squad memberships…");
  await bulkInsert(
    "squad_memberships",
    ["id", "person_id", "squad_id", "allocation_pct", "effective_from", "effective_to"],
    snapshot.squadMemberships.map((m) => [
      m.id, m.personId, m.squadId, n(m.allocationPct), new Date(m.effectiveFrom), d(m.effectiveTo),
    ]),
  );
  await resetSeq("squad_memberships");

  console.log("Seeding person roles…");
  // seniority is varchar in the DB (not an enum), so no cast needed
  await bulkInsert(
    "person_roles",
    ["id", "person_id", "role_type", "seniority", "is_primary", "effective_from", "effective_to"],
    snapshot.personRoles.map((r) => [
      r.id, r.personId, r.roleType, r.seniority ?? null, r.isPrimary,
      new Date(r.effectiveFrom), d(r.effectiveTo),
    ]),
    [null, null, "roletype", null, null, null, null],
  );
  await resetSeq("person_roles");

  console.log("Seeding squad capacity configs…");
  await bulkInsert(
    "squad_capacity_configs",
    ["id", "squad_id", "role_type", "hard_buffer_pct", "soft_buffer_pct"],
    snapshot.squadCapacityConfigs.map((c) => [
      c.id, c.squadId, c.roleType, n(c.hardBufferPct), n(c.softBufferPct),
    ]),
    [null, null, "roletype", null, null],
  );
  await resetSeq("squad_capacity_configs");

  console.log("Seeding client person access…");
  await bulkInsert(
    "client_person_access",
    ["id", "client_id", "person_id", "granted_at", "granted_by", "revoked_at"],
    snapshot.clientPersonAccess.map((a) => [
      a.id, a.clientId, a.personId, new Date(a.grantedAt), a.grantedBy ?? null, d(a.revokedAt),
    ]),
  );

  console.log("Seeding role cascade rules…");
  await bulkInsert(
    "role_cascade_rules",
    ["id", "client_id", "trigger_role", "dependent_role", "ratio"],
    snapshot.roleCascadeRules.map((r) => [
      r.id, r.clientId ?? null, r.triggerRole, r.dependentRole, n(r.ratio),
    ]),
    [null, null, "roletype", "roletype", null],
  );

  console.log("Seeding holiday calendars…");
  await bulkInsert(
    "holiday_calendars",
    ["id", "region", "name"],
    snapshot.holidayCalendars.map((c) => [c.id, c.region, c.name]),
  );

  console.log("Seeding holiday entries…");
  await bulkInsert(
    "holiday_entries",
    ["id", "calendar_id", "date", "name"],
    snapshot.holidayEntries.map((e) => [e.id, e.calendarId, new Date(e.date), e.name]),
  );

  console.log("Seeding person calendar assignments…");
  await bulkInsert(
    "person_calendar_assignments",
    ["id", "person_id", "calendar_id", "effective_from"],
    snapshot.personCalendarAssignments.map((a) => [
      a.id, a.personId, a.calendarId, new Date(a.effectiveFrom),
    ]),
  );

  console.log("Seeding retainer contracts…");
  await bulkInsert(
    "retainer_contracts",
    ["id", "client_id", "squad_id", "total_pool_hours", "status", "valid_from", "valid_to"],
    snapshot.retainerContracts.map((c) => [
      c.id, c.clientId, c.squadId, n(c.totalPoolHours), c.status, new Date(c.validFrom), d(c.validTo),
    ]),
    [null, null, null, null, "contractstatus", null, null],
  );
  await resetSeq("retainer_contracts");

  console.log("Seeding contract extensions…");
  await bulkInsert(
    "contract_extensions",
    ["id", "client_id", "month", "type", "status", "requested_hours", "role_type", "rate_override", "approved_by", "approved_at", "notes"],
    snapshot.contractExtensions.map((e) => [
      e.id, e.clientId, new Date(e.month), e.type, e.status, n(e.requestedHours),
      e.roleType ?? null, n(e.rateOverride), e.approvedBy ?? null, d(e.approvedAt), e.notes ?? null,
    ]),
    [null, null, null, "extensiontype", "extensionstatus", null, "roletype", null, null, null, null],
  );
  if (snapshot.contractExtensions.length > 0) await resetSeq("contract_extensions");

  console.log("Seeding billing rates…");
  await bulkInsert(
    "billing_rates",
    ["id", "client_id", "role_type", "rate_per_hour", "currency", "effective_from", "effective_to"],
    snapshot.billingRates.map((r) => [
      r.id, r.clientId, r.roleType ?? null, n(r.ratePerHour), r.currency,
      new Date(r.effectiveFrom), d(r.effectiveTo),
    ]),
    [null, null, "roletype", null, "currency", null, null],
  );

  console.log("Seeding cost rates…");
  await bulkInsert(
    "cost_rates",
    ["id", "person_id", "role_type", "rate_per_hour", "currency", "effective_from", "effective_to"],
    snapshot.costRates.map((r) => [
      r.id, r.personId ?? null, r.roleType ?? null, n(r.ratePerHour), r.currency,
      new Date(r.effectiveFrom), d(r.effectiveTo),
    ]),
    [null, null, "roletype", null, "currency", null, null],
  );

  console.log("Seeding TE billing configs…");
  await bulkInsert(
    "te_billing_configs",
    ["id", "client_id", "type", "value", "currency"],
    snapshot.teBillingConfigs.map((c) => [
      c.id, c.clientId, c.type, n(c.value), c.currency ?? null,
    ]),
    [null, null, "tebillingtype", null, "currency"],
  );

  console.log("Seeding TE billing role rates…");
  await bulkInsert(
    "te_billing_role_rates",
    ["id", "te_billing_config_id", "role_type", "rate_per_hour", "currency"],
    snapshot.teBillingRoleRates.map((r) => [
      r.id, r.teBillingConfigId, r.roleType, n(r.ratePerHour), r.currency,
    ]),
    [null, null, "roletype", null, "currency"],
  );

  console.log("Seeding change orders…");
  await bulkInsert(
    "change_orders",
    ["id", "client_id", "squad_id", "date_range_start", "date_range_end", "status", "written_approval_ref", "written_approval_at", "docusign_envelope_id", "docusign_signed_at", "notes"],
    snapshot.changeOrders.map((o) => [
      o.id, o.clientId, o.squadId, new Date(o.dateRangeStart), new Date(o.dateRangeEnd),
      o.status, o.writtenApprovalRef ?? null, d(o.writtenApprovalAt),
      o.docusignEnvelopeId ?? null, d(o.docusignSignedAt), o.notes ?? null,
    ]),
    [null, null, null, null, null, "changeorderstatus", null, null, null, null, null],
  );

  console.log("Seeding change order line items…");
  await bulkInsert(
    "change_order_line_items",
    ["id", "change_order_id", "role_type", "hours", "rate_override"],
    snapshot.changeOrderLineItems.map((i) => [
      i.id, i.changeOrderId, i.roleType, n(i.hours), n(i.rateOverride),
    ]),
    [null, null, "roletype", null, null],
  );

  console.log("Seeding SME engagements…");
  await bulkInsert(
    "sme_engagements",
    ["id", "client_id", "squad_id", "month", "role_description", "source", "person_id", "contracted_hours", "cost_rate", "billing_rate", "currency", "approved_by", "status"],
    snapshot.smeEngagements.map((e) => [
      e.id, e.clientId, e.squadId, new Date(e.month), e.roleDescription, e.source,
      e.personId ?? null, n(e.contractedHours), n(e.costRate), n(e.billingRate), e.currency,
      e.approvedBy ?? null, e.status,
    ]),
    [null, null, null, null, null, "smesource", null, null, null, null, "currency", null, "smestatus"],
  );

  console.log("Seeding NB categories…");
  await bulkInsert(
    "nonbillable_categories",
    ["id", "name", "type", "description"],
    snapshot.nonBillableCategories.map((c) => [c.id, c.name, c.type, c.description ?? null]),
    [null, null, "nonbillabletype", null],
  );
  await resetSeq("nonbillable_categories");

  console.log("Seeding NB source mappings…");
  await bulkInsert(
    "nonbillable_source_mappings",
    ["id", "source", "identifier_type", "identifier_value", "category_id"],
    snapshot.nonBillableSourceMappings.map((m) => [
      m.id, m.source, m.identifierType, m.identifierValue, m.categoryId,
    ]),
  );
  if (snapshot.nonBillableSourceMappings.length > 0) await resetSeq("nonbillable_source_mappings");

  console.log("Seeding tempo account client mappings…");
  await bulkInsert(
    "tempo_account_client_mappings",
    ["id", "account_key", "client_id", "effective_from", "effective_to"],
    snapshot.tempoAccountClientMappings.map((m) => [
      m.id, m.accountKey, m.clientId, new Date(m.effectiveFrom), d(m.effectiveTo),
    ]),
  );
  if (snapshot.tempoAccountClientMappings.length > 0) await resetSeq("tempo_account_client_mappings");

  console.log("Seeding Jira component client mappings…");
  await bulkInsert(
    "jira_component_client_mappings",
    ["id", "jira_instance", "component_key", "client_id", "effective_from", "effective_to"],
    snapshot.jiraComponentClientMappings.map((m) => [
      m.id, m.jiraInstance, m.componentKey, m.clientId, new Date(m.effectiveFrom), d(m.effectiveTo),
    ]),
  );
  if (snapshot.jiraComponentClientMappings.length > 0) await resetSeq("jira_component_client_mappings");

  console.log("Seeding monthly role declarations…");
  await bulkInsert(
    "monthly_role_declarations",
    ["id", "contract_id", "extension_id", "client_id", "squad_id", "month", "role_type", "declared_hours", "status", "submitted_at", "submitted_by", "change_from_prior_hours", "significant_change_flag", "late_change_flag", "override_reason", "override_by"],
    snapshot.monthlyRoleDeclarations.map((dec) => [
      dec.id, dec.contractId ?? null, dec.extensionId ?? null, dec.clientId, dec.squadId,
      new Date(dec.month), dec.roleType, n(dec.declaredHours), dec.status,
      d(dec.submittedAt), dec.submittedBy ?? null, n(dec.changeFromPriorHours),
      dec.significantChangeFlag, dec.lateChangeFlag, dec.overrideReason ?? null, dec.overrideBy ?? null,
    ]),
    [null, null, null, null, null, null, "roletype", null, "declarationstatus", null, null, null, null, null, null, null],
  );
  await resetSeq("monthly_role_declarations");

  console.log("Seeding hour records…");
  // hoursource is the actual Postgres enum name for the SyncSource Prisma enum
  await bulkInsert(
    "hour_records",
    ["id", "person_id", "client_id", "date", "hours", "role_type", "source", "budget_source", "contract_extension_id", "change_order_id", "sme_engagement_id", "external_ref", "description", "issue_key", "issue_summary"],
    snapshot.hourRecords.map((h) => [
      h.id, h.personId, h.clientId, new Date(h.date), n(h.hours), h.roleType, h.source, h.budgetSource,
      h.contractExtensionId ?? null, h.changeOrderId ?? null, h.smeEngagementId ?? null,
      h.externalRef ?? null, h.description ?? null, h.issueKey ?? null, h.issueSummary ?? null,
    ]),
    [null, null, null, null, null, "roletype", "hoursource", "budgetsource", null, null, null, null, null, null, null],
  );
  await resetSeq("hour_records");

  console.log("Seeding NB entries…");
  await bulkInsert(
    "nonbillable_entries",
    ["id", "person_id", "squad_id", "date", "hours", "category_id", "notes", "external_ref"],
    snapshot.nonBillableEntries.map((e) => [
      e.id, e.personId, e.squadId, new Date(e.date), n(e.hours), e.categoryId,
      e.notes ?? null, e.externalRef ?? null,
    ]),
  );
  await resetSeq("nonbillable_entries");

  console.log("Seeding sync logs…");
  // hoursource is the actual Postgres enum name for sync_logs.source too
  await bulkInsert(
    "sync_logs",
    ["id", "source", "sync_type", "started_at", "completed_at", "date_from", "date_to", "records_fetched", "records_created", "records_skipped", "records_conflicted", "error_message", "unmapped_refs"],
    snapshot.syncLogs.map((l) => [
      l.id, l.source, l.syncType, new Date(l.startedAt), d(l.completedAt),
      d(l.dateFrom), d(l.dateTo), l.recordsFetched, l.recordsCreated,
      l.recordsSkipped, l.recordsConflicted, l.errorMessage ?? null, l.unmappedRefs ?? null,
    ]),
    [null, "hoursource", null, null, null, null, null, null, null, null, null, null, null],
  );
  if (snapshot.syncLogs.length > 0) await resetSeq("sync_logs");

  console.log("Seeding client simulations…");
  await bulkInsert(
    "client_simulations",
    ["id", "client_id", "name", "proposed_client_name", "proposed_start_month", "proposed_pool_hours", "requested_by", "approved_at", "approved_by", "simulation_result", "feasible", "bottleneck_role"],
    snapshot.clientSimulations.map((s) => [
      s.id, s.clientId ?? null, s.name, s.proposedClientName, new Date(s.proposedStartMonth),
      n(s.proposedPoolHours), s.requestedBy ?? null, d(s.approvedAt), s.approvedBy ?? null,
      s.simulationResult ?? null, s.feasible ?? null, s.bottleneckRole ?? null,
    ]),
    [null, null, null, null, null, null, null, null, null, null, null, "roletype"],
  );

  console.log("Seeding client simulation line items…");
  // action is varchar in DB (not a postgres enum), no cast needed
  await bulkInsert(
    "client_simulation_line_items",
    ["id", "simulation_id", "role_type", "requested_hours", "available_hours", "gap_hours", "action", "ftes_to_hire", "estimated_margin_pct"],
    snapshot.clientSimulationLineItems.map((i) => [
      i.id, i.simulationId, i.roleType, n(i.requestedHours), n(i.availableHours), n(i.gapHours),
      i.action, n(i.ftesToHire), n(i.estimatedMarginPct),
    ]),
    [null, null, "roletype", null, null, null, null, null, null],
  );

  // ── Pre-seed prior-month NB summaries so MoM delta works ─────────────────────
  console.log("Pre-seeding prior-month NB summaries for MoM delta…");
  // Seed all prior-month NB summaries; refresh will create/update the current-month ones.
  const priorNbSummaries = snapshot.monthlyNonBillableSummaries.filter(
    (s) => s.month.substring(0, 7) < curMonth,
  );
  await bulkInsert(
    "monthly_nonbillable_summaries",
    ["id", "person_id", "squad_id", "month", "category_type", "total_hours", "capacity_hours", "nonbillable_pct", "billable_hours_lost", "prior_month_hours", "month_over_month_delta"],
    priorNbSummaries.map((s) => [
      s.id, s.personId, s.squadId, new Date(s.month), s.categoryType ?? null,
      n(s.totalHours), n(s.capacityHours), n(s.nonbillablePct), n(s.billableHoursLost),
      n(s.priorMonthHours), n(s.monthOverMonthDelta),
    ]),
    [null, null, null, null, "nonbillabletype", null, null, null, null, null, null],
  );
  if (priorNbSummaries.length > 0) await resetSeq("monthly_nonbillable_summaries");

  // Pre-seed prior-month ceremony allocations.
  // runAnalyticsRefresh uses a bare .create() for the current month (no upsert),
  // so seeding current-month rows here would cause a unique-constraint violation.
  console.log("Pre-seeding prior-month ceremony allocations…");
  const priorCeremonyAllocs = snapshot.monthlyCeremonyAllocations.filter(
    (a) => a.month.substring(0, 7) < curMonth,
  );
  await bulkInsert(
    "monthly_ceremony_allocations",
    ["id", "person_id", "client_id", "squad_id", "month", "allocated_hours"],
    priorCeremonyAllocs.map((a) => [
      a.id, a.personId, a.clientId, a.squadId ?? null, new Date(a.month), n(a.allocatedHours),
    ]),
  );
  if (priorCeremonyAllocs.length > 0) await resetSeq("monthly_ceremony_allocations");

  // Pre-seed analytics snapshots. Refresh will upsert/update the current-month ones;
  // historical months (not recomputed by refresh) stay exactly as captured.
  console.log("Pre-seeding weekly burn snapshots…");
  await bulkInsert(
    "weekly_burn_snapshots",
    ["id", "client_id", "week_start", "role_type", "cumulative_hours", "expected_cumulative", "burn_rate_ratio", "projected_eom_hours", "pool_hours", "alert_level", "projected_exhaustion_date"],
    snapshot.weeklyBurnSnapshots.map((s) => [
      s.id, s.clientId, new Date(s.weekStart), s.roleType ?? null,
      n(s.cumulativeHours), n(s.expectedCumulative), n(s.burnRateRatio),
      n(s.projectedEomHours), n(s.poolHours), s.alertLevel, d(s.projectedExhaustionDate),
    ]),
    [null, null, null, "roletype", null, null, null, null, null, "alertlevel", null],
  );
  if (snapshot.weeklyBurnSnapshots.length > 0) await resetSeq("weekly_burn_snapshots");

  console.log("Pre-seeding monthly consumption summaries…");
  await bulkInsert(
    "monthly_consumption_summaries",
    ["id", "client_id", "month", "role_type", "declared_hours", "consumed_hours", "retainer_hours", "te_hours", "co_hours", "sme_hours", "remaining_hours", "utilization_pct", "billed_revenue", "direct_cost", "attributed_ceremony_cost", "gross_margin", "gross_margin_pct"],
    snapshot.monthlyConsumptionSummaries.map((s) => [
      s.id, s.clientId, new Date(s.month), s.roleType ?? null,
      n(s.declaredHours), n(s.consumedHours), n(s.retainerHours),
      n(s.teHours), n(s.coHours), n(s.smeHours), n(s.remainingHours), n(s.utilizationPct),
      n(s.billedRevenue), n(s.directCost), n(s.attributedCeremonyCost),
      n(s.grossMargin), n(s.grossMarginPct),
    ]),
    [null, null, null, "roletype", null, null, null, null, null, null, null, null, null, null, null, null, null],
  );
  if (snapshot.monthlyConsumptionSummaries.length > 0) await resetSeq("monthly_consumption_summaries");

  console.log("Pre-seeding staffing gap snapshots…");
  await bulkInsert(
    "staffing_gap_snapshots",
    ["id", "squad_id", "role_type", "month", "total_available_hours", "hard_buffer_hours", "soft_buffer_hours", "committed_hours", "actual_hours", "unplanned_hours", "actual_nb_hours", "net_gap_hours", "commitment_ratio", "is_understaffed", "is_overstaffed"],
    snapshot.staffingGapSnapshots.map((s) => [
      s.id, s.squadId, s.roleType, new Date(s.month),
      n(s.totalAvailableHours), n(s.hardBufferHours), n(s.softBufferHours),
      n(s.committedHours), n(s.actualHours), n(s.unplannedHours), n(s.actualNbHours),
      n(s.netGapHours), n(s.commitmentRatio), s.isUnderstaffed, s.isOverstaffed,
    ]),
    [null, null, "roletype", null, null, null, null, null, null, null, null, null, null, null, null],
  );
  if (snapshot.staffingGapSnapshots.length > 0) await resetSeq("staffing_gap_snapshots");

  console.log("Pre-seeding ceremony attributions…");
  await bulkInsert(
    "ceremony_attributions",
    ["id", "squad_id", "client_id", "month", "squad_total_ceremony_hours", "client_actual_hours", "squad_total_actual_hours", "attribution_fraction", "attributed_hours", "cost_impact"],
    snapshot.ceremonyAttributions.map((s) => [
      s.id, s.squadId, s.clientId, new Date(s.month),
      n(s.squadTotalCeremonyHours), n(s.clientActualHours), n(s.squadTotalActualHours),
      n(s.attributionFraction), n(s.attributedHours), n(s.costImpact),
    ]),
  );
  if (snapshot.ceremonyAttributions.length > 0) await resetSeq("ceremony_attributions");

  console.log("Pre-seeding anomaly flags…");
  await bulkInsert(
    "anomaly_flags",
    ["id", "client_id", "squad_id", "month", "role_type", "flag_type", "severity", "detector_version", "explanation", "detected_at", "resolved_at", "resolved_by", "resolution_notes"],
    snapshot.anomalyFlags.map((s) => [
      s.id, s.clientId, s.squadId ?? null, new Date(s.month), s.roleType ?? null,
      s.flagType, s.severity, s.detectorVersion, s.explanation ?? null,
      new Date(s.detectedAt), d(s.resolvedAt), s.resolvedBy ?? null, s.resolutionNotes ?? null,
    ]),
    [null, null, null, null, "roletype", "anomalyflagtype", "anomalyseverity", null, null, null, null, null, null],
  );
  if (snapshot.anomalyFlags.length > 0) await resetSeq("anomaly_flags");

  console.log("Pre-seeding NB enhancement suggestions…");
  await bulkInsert(
    "nonbillable_enhancement_suggestions",
    ["id", "person_id", "squad_id", "month", "suggestion_type", "status", "explanation", "suggested_action", "suggested_hours", "current_hours", "detected_at", "resolved_at", "resolved_by"],
    snapshot.nonBillableEnhancementSuggestions.map((s) => [
      s.id, s.personId ?? null, s.squadId ?? null, new Date(s.month),
      s.suggestionType, s.status, s.explanation, s.suggestedAction,
      n(s.suggestedHours), n(s.currentHours),
      new Date(s.detectedAt), d(s.resolvedAt), s.resolvedBy ?? null,
    ]),
    [null, null, null, null, "suggestiontype", "suggestionstatus", null, null, null, null, null, null, null],
  );
  if (snapshot.nonBillableEnhancementSuggestions.length > 0) await resetSeq("nonbillable_enhancement_suggestions");

  // ── Run analytics refresh ──────────────────────────────────────────────────
  // NOTE: runAnalyticsRefresh() uses Prisma enum-filter queries that fail against
  // this database because the DB enum types are lowercase (e.g. `contractstatus`)
  // while Prisma generates casts to `public."ContractStatus"` (PascalCase).
  // Analytics data is already pre-seeded from the snapshot above, so the refresh
  // is a best-effort update; failures are expected and non-fatal.
  console.log("Running analytics refresh…");
  try {
    await runAnalyticsRefresh();
  } catch (refreshErr) {
    console.warn("Analytics refresh skipped (Prisma/DB enum type mismatch):", (refreshErr as Error).message?.substring(0, 120));
  }

  console.log("Seed complete.");
  console.log(`  Squads: ${snapshot.squads.map((s) => `${s.name} (${s.id})`).join(", ")}`);
  console.log(`  Clients: ${snapshot.clients.length} clients seeded`);
  console.log(`  People: ${snapshot.persons.map((p) => p.name).join(", ")}`);
  console.log(`  Month: ${curMonth}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
