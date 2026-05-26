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
| `/sync` | Manually trigger Jira/Tempo data sync and analytics refresh |

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

> **Note:** `HourRecord` and `NonBillableEntry` are populated by the Tempo/Jira sync jobs. If no sync has run, person and squad reports will return rows with zero hours. Client reports rely on `MonthlyConsumptionSummary`, which is populated by the analytics-refresh cron job.

---

## Management tab

`/management` provides create, edit, archive, and unarchive for four entities:

**Squads** — name, lead person, active member count. Archiving ends all open squad memberships.

**Persons** — name, email, employment type, weekly capacity hours, Tempo account ID, cost/hr, squad assignment with allocation %. Archiving ends memberships and removes the person as squad lead on any squad they lead.

**Clients** — name, region (NA/EMEA), currency (USD/GBP/EUR). Archiving closes all active retainer contracts.

**Components** — Jira component → client mappings (`jiraInstance`, `componentKey`, `effectiveFrom`). Archive sets `effectiveTo = today`; unarchive clears it. Component key and effective date are immutable after creation.

All entities support a **Show Archived** toggle. Archive is soft-only — no hard deletes anywhere.

API routes live under `/api/management/{squads,persons,clients,components}/[id]/{archive,unarchive}`.

---

## Sync tab

`/sync` lets you manually trigger data sync from Jira/Tempo and analytics refresh without needing a cron secret or curl command.

### Controls

**Date Range** — shared `from` / `to` date picker. Defaults to last 30 days. Used by both operations below.

**Data Sync** — independent checkboxes for Tempo and Jira NA. Triggers `POST /api/admin/jobs/sync` with `source`, `date_from`, and `date_to`. Always runs in `full` mode.

**Analytics Refresh** — derives the month list from the selected date range (one entry per calendar month between `from` and `to`). Triggers `POST /api/admin/jobs/analytics-refresh`.

Both buttons disable while the job runs and show an inline success/error banner on completion. Jobs can take several minutes depending on the date range and data volume.

### Last Sync Status

A status card at the top of the page shows the most recent sync log per source (Tempo, Jira NA). Each entry displays:

- Date and time the sync started
- Sync type (`full` / `delta`)
- Date range that was synced
- Error message if the sync failed

Status refreshes automatically after each triggered sync. `SyncLog` rows now persist `date_from` and `date_to` — older rows will show `—` for the date range.

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

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Seed the database

```bash
npx prisma db seed
```

Seeds 2 squads, 6 people, 2 clients, contracts, hour records, NB entries, and runs the full analytics pipeline.

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
| `/api/admin/jobs/sync` | `POST` | `{ source?: "tempo"\|"jira_na"\|"all", date_from?: string, date_to?: string }` | Pulls data from Jira / Tempo. Defaults: source=`all`, last 30 days. Always runs in `full` mode. |
| `/api/admin/jobs/sync` | `GET` | — | Returns the latest `SyncLog` entry per source. |
| `/api/admin/jobs/analytics-refresh` | `POST` | `{ months?: string[] }` | Recomputes analytics for the given months (ISO date strings, first of month). Defaults to current + prior month. |

Example:

```bash
curl -X POST http://localhost:3000/api/admin/jobs/sync \
  -H "Content-Type: application/json" \
  -d '{"source":"all","date_from":"2025-04-01","date_to":"2025-04-30"}'
```
