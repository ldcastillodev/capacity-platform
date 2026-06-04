# MgS Capacity Platform

Squad capacity planning and delivery tracking. Tracks staffing gaps, retainer burn, non-billable hours, and T&E declarations across client squads.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router, TypeScript strict) |
| ORM | Prisma 5 → PostgreSQL 16 |
| Data fetching | TanStack Query v5 |
| Styling | CSS variables (no Tailwind) |
| Charts | Recharts |
| Deployment | Firebase App Hosting + Cloud SQL |

## Pages

| Route | Description |
|---|---|
| `/` | Overview dashboard — active clients, alert counts, gross margin, burn status breakdown |
| `/burn` | Weekly burn rate per client — cumulative vs expected pace, pool exhaustion projection |
| `/nonbillable` | NB hour summaries and enhancement suggestions |
| `/consumption` | Client retainer burn and T&E declarations |
| `/capacity` | Squad staffing gaps and commitment ratios |
| `/declarations` | Monthly role declarations — review, edit hours, confirm derived entries |
| `/flags` | Anomaly flags — review and resolve open alerts |
| `/simulator` | Model staffing changes and forecast impact |
| `/reports` | Configurable hour-consumption reports for clients, persons, and squads |
| `/management` | CRUD for squads, persons, clients, and Jira component mappings |
| `/sync` | Manually trigger Jira data sync and analytics refresh |

## Reports tab

`/reports` generates on-demand hour-consumption reports across three dimensions. **Reports do not run on page load** — select a date range in the filter panel and click Apply first.

### Tabs

**Clients** — powered by `MonthlyConsumptionSummary`. One row per client × month × role type (or "All roles" when no role filter is active).

| Column | Source |
|---|---|
| Declared h | `declaredHours` |
| Consumed h | `consumedHours` (billable) |
| Retainer / T&E / CO / SME h | budget-source breakdown |
| Remaining h | `remainingHours` |
| NB (Ceremony) h | `CeremonyAttribution.attributedHours` summed per client × month |
| Utilization % | `utilizationPct` |
| Billed Rev / Direct Cost / Gross Margin | financial fields (may be null if not computed) |

**Persons** — aggregated from `HourRecord` (billable) and `MonthlyNonBillableSummary` (NB + capacity). One row per person × squad × month. A person in two squads appears twice.

| Column | Source |
|---|---|
| Capacity h | `MonthlyNonBillableSummary.capacityHours` (null-category row) |
| Billable h | `SUM(HourRecord.hours)` for that person × month |
| NB h | `MonthlyNonBillableSummary.totalHours` |
| NB % | `MonthlyNonBillableSummary.nonbillablePct` |
| Utilization | Billable h / Capacity h |

**Squads** — aggregated from `HourRecord` and `NonBillableEntry` via `SquadMembership`. One row per squad × month. Capacity is computed as `SUM(weeklyCapacityHours × workingDaysInMonth / 5)` for active members. Filtering by role type affects billable hours only (NB entries have no role).

### Filters (slide-over panel)

Open with **Filters & Columns**. Changes are local to the panel until Apply is clicked — the report does not re-run on every keystroke.

| Filter | Available on |
|---|---|
| Date range (from / to, month precision, inclusive) | All tabs |
| Client | Clients tab |
| Role type | Clients tab, Squads tab |
| Squad | Persons tab, Squads tab |
| Employment type | Persons tab |

### Column visibility

Uncheck any column in the panel to hide it from the table. Columns are in-session only — they reset on page reload.

### XLSX export

Click **Export XLSX** to download the currently filtered rows (all pages, not just the visible page) with only the visible columns. The file is generated client-side via SheetJS (`xlsx` package) — no server round-trip.

Filename format: `report-{clients|persons|squads}-{from}-{to}.xlsx`

### API routes

| Route | Params |
|---|---|
| `GET /api/reports/clients` | `from`, `to`, `clientId`, `roleType`, `page`, `pageSize` |
| `GET /api/reports/persons` | `from`, `to`, `squadId`, `employmentType`, `page`, `pageSize` |
| `GET /api/reports/squads` | `from`, `to`, `squadId`, `roleType`, `page`, `pageSize` |

All routes return `{ data, total, page, pageSize, totalPages }`. Persons and squads use raw SQL (`prisma.$queryRaw`) for the aggregation; clients use the Prisma ORM.

> **Note:** `HourRecord` and `NonBillableEntry` are populated by the Jira sync jobs. If no sync has run, person and squad reports will return rows with zero hours. Client reports rely on `MonthlyConsumptionSummary`, which is populated by the analytics-refresh cron job.

---

## Management tab

`/management` has 11 tabs across six functional areas. All writes are soft-only — no hard deletes anywhere.

### Core entities

**Squads** — name, lead person, active member count. Archiving ends all open squad memberships.

**Persons** — name, email, employment type, weekly capacity hours, squad assignment with allocation %. Archiving ends memberships and removes the person as squad lead on any squad they lead.

**Clients** — name, region (NA/EMEA), currency (USD/GBP/EUR). Archiving closes all active retainer contracts.

> **Guard:** Currency is immutable once any `HourRecord` or `BillingRate` references the client. The API returns `400` if you attempt a currency change on a client with existing billing data.

**Components** — Jira component → client mappings (`jiraInstance`, `componentKey`, `effectiveFrom`). Archive sets `effectiveTo = today`; unarchive clears it. Component key and effective date are immutable after creation.

> **Guard:** A squad's lead person must have an active `SquadMembership` for that squad. The API returns `400` if you set `leadPersonId` to someone not currently on the squad.

All core entities support a **Show Archived** toggle.

---

### Billing tab

Four sub-tabs, all create/delete only (no edit):

**Billing Rates** — client × role type × effective date range → rate per hour + currency.

**Cost Rates** — person × role type × effective date range → rate per hour + currency.

**T&E Billing Config** — per-client T&E billing type (`same_rate`, `premium_flat`, `premium_pct`, `blended_rate`, `per_role`). A nested modal manages role-specific rates when type is `per_role`.

**Client Person Access** — grant/revoke person access to a client. Shows current status (active or revoked with timestamp).

---

### Contracts tab

Five sub-tabs:

**Retainer Contracts** — client × squad, total pool hours, valid date range, status (`active` / `paused` / `closed` / `pending_approval` / `pending_written` / `pending_docusign` / `approved` / `rejected` / `derived` / `locked`). Supports pause, activate, and close actions. Closed contracts are read-only.

**Contract Extensions** — per-client, per-month T&E or change-order extensions with requested hours, role type, rate override, notes, and approval status. Supports approve, reject, and close actions.

**Change Orders** — multi-line-item change orders. Line items are editable and deletable only while the order is in `pending_written` or `pending_docusign` status.

**SME Engagements** — subject-matter-expert engagement records: client, squad, month, role description, contracted hours, cost/billing rates, currency, approver, status. Read-only once closed.

**Declarations** — read-only view of monthly role declarations; searchable by declaration or contract ID.

---

### Workforce tab

Three sub-tabs:

**Squad Memberships** — person × squad, allocation % (0–100), effective date range. Supports create, edit, and delete.

**Person Roles** — person × role type × seniority (L1–L5), primary flag, effective date range. Supports create, edit, and delete. Only one primary role per person is allowed.

**Capacity Configs** — squad × role type, hard buffer %, soft buffer %. Supports create, edit, and delete.

---

### Non-Billable tab

Three sub-tabs:

**Categories** — NB category name, type (`internal_ceremony` / `learning_and_development` / `admin` / `other`), description. Archive deactivates (sets `deactivatedAt`); no delete.

**Source Mappings** — map a Jira NA identifier (account key, component, or project key) to an NB category. Create and delete only.

**Entries** — read-only view of NB hour entries by person, category, month, hours, and source. Searchable by person name and month.

---

### Analytics tab

Six read-only sub-tabs showing computed analytics data:

**Consumption** — `MonthlyConsumptionSummary` rows: client × month × role type, declared/consumed/remaining hours, utilization %.

**Burn** — `BurnSnapshot` rows: client × week, cumulative vs expected burn, burn-rate ratio, projected end-of-month hours, alert level.

**Staffing** — `StaffingGapSnapshot` rows: squad × month × role type, available/committed/net-gap hours, under/overstaffed flags.

**Anomaly Flags** — `AnomalyFlag` rows with flag type, severity, explanation, and detected/resolved timestamps. Flags can be resolved inline (resolution notes required).

**Suggestions** — NB enhancement suggestions. Status transitions: `open` → `acknowledged` → `applied` or `dismissed`. Terminal statuses (`applied`, `dismissed`) block further actions.

**NB Summaries** — `MonthlyNonBillableSummary` rows: person × squad × month × category type, total hours, NB %.

---

### Audit tab

Seven read-only sub-tabs showing append-only history ledgers:

| Sub-tab | Ledger | Searchable by |
|---|---|---|
| Declarations | `MonthlyRoleDeclarationHistory` | Declaration ID |
| Contract Amendments | `ContractHistory` | Contract ID |
| Extensions | `ContractExtensionHistory` | Extension ID |
| Change Orders | (change-order history) | Change order ID |
| Line Items | (line-item history) | Line item ID |
| SME Engagements | (SME history) | Engagement ID |
| Sync Logs | `SyncLog` | Source |

Each ledger row stores a full snapshot of the parent record at the time of change plus `changedAt` and `changedBy`.

---

API routes live under `/api/management/{squads,persons,clients,components,billing-rates,cost-rates,te-billing-configs,client-person-access,retainer-contracts,contract-extensions,change-orders,sme-engagements,declarations,squad-memberships,person-roles,squad-capacity-configs,holiday-calendars,holiday-entries,person-calendar-assignments,role-cascade-rules,nonbillable-categories,nonbillable-source-mappings,nonbillable-entries}/`.

---

## Sync tab

`/sync` lets you manually trigger data sync from Jira and analytics refresh without needing a cron secret or curl command.

### Controls

**Date Range** — shared `from` / `to` date picker. Defaults to last 30 days. Used by both operations below.

**Data Sync** — independent checkboxes for Jira NA. Triggers `POST /api/admin/jobs/sync` with `source`, `date_from`, and `date_to`. Always runs in `full` mode.

**Analytics Refresh** — derives the month list from the selected date range (one entry per calendar month between `from` and `to`). Triggers `POST /api/admin/jobs/analytics-refresh`.

Both buttons disable while the job runs and show an inline success/error banner on completion. Jobs can take several minutes depending on the date range and data volume.

### Last Sync Status

A status card at the top of the page shows the most recent sync log per source (Jira NA). Each entry displays:

- Date and time the sync started
- Sync type (`full` / `delta`)
- Date range that was synced
- Error message if the sync failed

Status refreshes automatically after each triggered sync. `SyncLog` rows now persist `date_from` and `date_to` — older rows will show `—` for the date range.

---

## Schema

### Financial immutability

`HourRecord` carries five denormalized snapshot columns that are written once at insert time and never updated:

| Column | Type | Purpose |
|---|---|---|
| `billingRateSnapshot` | `Decimal?` | Billing rate in effect when the record was synced |
| `costRateSnapshot` | `Decimal?` | Cost rate in effect when the record was synced |
| `currencySnapshot` | `Currency?` | Currency in effect at sync time |
| `billedAmountSnapshot` | `Decimal?` | `hours × billingRateSnapshot` |
| `costAmountSnapshot` | `Decimal?` | `hours × costRateSnapshot` |

`MonthlyConsumptionSummary` refresh reads from these snapshots instead of resolving live rates. This means financial reports remain stable even if billing rates change retroactively.

`Person.costPerHour` has been removed — cost is resolved at sync time and stored in `costRateSnapshot`.

### Historical capacity

`StaffingGapSnapshot` captures three at-calculation-time columns alongside the existing gap figures:

| Column | Purpose |
|---|---|
| `capacityHoursAtTime` | Total squad capacity (hours) at the time the snapshot was computed |
| `hardBufferPctAtTime` | Hard buffer % in effect at computation time |
| `softBufferPctAtTime` | Soft buffer % in effect at computation time |

### Audit ledgers

Six append-only history models record every state change for their parent entity:

`BillingRateHistory`, `ContractHistory`, `ContractExtensionHistory`, `MonthlyRoleDeclarationHistory`, `SquadMembershipHistory`, `StaffingGapSnapshotHistory`

Each ledger row stores a full copy of the parent's fields at the time of change plus `changedAt` and `changedBy`.

### Enum types

All PostgreSQL enum types follow camelCase naming (e.g., `"ContractStatus"`, `"Currency"`). If you restore from a pre-2026-05-27 dump, the types will be lowercase — apply `prisma/migrations/20260527_fix_enum_type_casing/migration.sql` before starting the app to rename them.

### Key constraints

- `PersonCalendarAssignment`: at most one active (open-ended) row per person — enforced by partial unique index `(personId) WHERE effectiveTo IS NULL`.
- `NonBillableCategory`: soft-delete via `isActive` / `deactivatedAt` — hard deletes are blocked by FK references.
- `ContractExtension`: carries `resolvedRate`, `resolvedCurrency`, and `updatedAt` for T&E approval workflows.

---

## Local development

### Prerequisites

- Node.js 20+
- Docker (for local Postgres)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in any required values (the defaults work for local Docker Postgres).

### 3. Start the database

```bash
docker compose up -d
```

### 4. Apply migrations

```bash
npx prisma migrate dev
```

This applies the single consolidated migration and generates the Prisma client.

> **Note:** The migration includes hand-crafted CHECK constraints and partial indexes appended after the Prisma-generated DDL. If you add new migrations, use `npx prisma migrate dev` as normal.

### 5. Seed the database

```bash
npx prisma db seed
```

Seeds a snapshot of the live database: 5 squads, 39 people, 25 clients, retainer contracts, 5 000+ hour records, NB entries, sync logs, and all analytics snapshots (staffing gaps, consumption summaries, burn snapshots, etc.).

Emails are scrubbed to `name@example.com`. All other IDs, dates, and numeric values are preserved exactly as captured.

> **Requires** `prisma/db-snapshot.json` to be present alongside `seed.ts`. The snapshot is committed to the repo. If you need to refresh it from a newer DB state, run `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/extract-db.ts` (see that file for instructions) and commit the updated JSON.

> **Analytics after seed:** The seed inserts raw `HourRecord` and `NonBillableEntry` rows but does not recompute derived summaries. After seeding, trigger an analytics refresh for the months you need (via the `/sync` page or the cron route) to populate `MonthlyConsumptionSummary`, `MonthlyNonBillableSummary`, and `StaffingGapSnapshot`.

### 6. Start the dev server

```bash
npm run dev
```

App available at http://localhost:3000.

---

## Database management

### Stop the database

```bash
docker compose stop
```

### Restart the database

```bash
docker compose restart
```

### Destroy and recreate (wipes all data)

```bash
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

### Open Prisma Studio (GUI for the DB)

```bash
npx prisma studio
```

### Re-run seed only (without wiping schema)

```bash
npx prisma db seed
```

> The seed script deletes all rows before re-inserting, so it is safe to run multiple times.

---

## Cron / scheduled jobs

Cron routes live under `/api/admin/jobs/`. No auth header is required — use the `/sync` page for manual triggering or restrict network access at the infrastructure level.

| Route | Method | Body | Purpose |
|---|---|---|---|
| `/api/admin/jobs/sync` | `POST` | `{ source?: "jira_na"\|"all", date_from?: string, date_to?: string }` | Pulls data from Jira. Defaults: source=`all`, last 30 days. Always runs in `full` mode. |
| `/api/admin/jobs/sync` | `GET` | — | Returns the latest `SyncLog` entry per source. |
| `/api/admin/jobs/analytics-refresh` | `POST` | `{ months?: string[] }` | Recomputes analytics for the given months (ISO date strings, first of month). Defaults to current + prior month. |

Example:

```bash
curl -X POST http://localhost:3000/api/admin/jobs/sync \
  -H "Content-Type: application/json" \
  -d '{"source":"all","date_from":"2025-04-01","date_to":"2025-04-30"}'
```
