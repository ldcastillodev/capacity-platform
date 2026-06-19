# MgS Capacity Platform

The MgS Capacity Platform is a squad capacity-planning and delivery-tracking app for delivery managers. It tracks staffing gaps, retainer and contract burn, non-billable hours, and monthly role declarations across client squads — all derived from hours synced out of Jira. Use it to see, month by month, how each client contract is consuming its hour pool, where squads are over- or under-committed, and where anomalies need attention.

## What to expect

### Capabilities

- Overview dashboard with per-contract health (On Track / Underconsumption / Watch / Critical), open flags, and key counts.
- Weekly burn-rate charts (actual vs. expected pace) and contract consumption tracking.
- Squad and role capacity views, non-billable summaries with suggestions, and anomaly flags.
- Monthly role declarations (planned hours) reviewed against actual synced hours.
- A staffing simulator to model new engagements, configurable reports with client-side XLSX export, and an admin area for full CRUD over clients, SOWs, contracts, Jira mappings, squads, people, and more.
- A manual sync page to pull Jira worklogs and recompute analytics without touching a cron.

### Known limitations

- Analytics pages read derived summaries that are produced by an analytics-refresh job; after a sync (or seed) you must trigger a refresh before those pages show data.
- All data depends on the Jira sync having run for the period you are viewing.
- A `.env` file with a valid `DATABASE_URL` is required — without it, Prisma commands and the app fail to connect (see [Local setup](#local-setup)).

## Prerequisites

- **Node.js 20+** (the app deploys on the Node 20 runtime)
- **npm** (the repo uses `package-lock.json`)
- **Docker** — for the local PostgreSQL 16 database
- _Optional:_ the Firebase CLI, only if you deploy to Firebase App Hosting (not needed for local development)

## Local setup

1. **Clone and enter the repo.**

   ```bash
   git clone <repo-url>
   cd capacity-platform
   ```

2. **Create your environment file.** Copy the example and fill in values. The Docker Postgres defaults below work as-is for local development; the Jira variables are only needed if you run a live sync.

   ```bash
   cp .env.example .env
   ```

   | Variable              | Purpose                                 |
   | --------------------- | --------------------------------------- |
   | `DATABASE_URL`        | PostgreSQL connection string (required) |
   | `JIRA_NA_BASE_URL`    | Jira North America instance base URL    |
   | `JIRA_NA_EMAIL`       | Jira NA service-account email           |
   | `JIRA_NA_API_TOKEN`   | Jira NA API token                       |
   | `JIRA_EMEA_BASE_URL`  | Jira EMEA instance base URL             |
   | `JIRA_EMEA_EMAIL`     | Jira EMEA service-account email         |
   | `JIRA_EMEA_API_TOKEN` | Jira EMEA API token                     |

   For local Docker Postgres, set:

   ```bash
   DATABASE_URL="postgresql://capacity:capacity@localhost:5432/capacity_platform"
   ```

   > **Heads up:** if you skip this step, Prisma commands and `npm run dev` will fail to connect to the database.

3. **Install dependencies.** The `postinstall` hook runs `prisma generate` automatically.

   ```bash
   npm install
   ```

4. **Start the database.**

   ```bash
   docker compose up -d
   ```

5. **Apply migrations.** Do **not** use `prisma migrate dev` — the migration history contains hand-crafted DDL that Prisma cannot shadow-apply safely. Apply each pending migration directly, then regenerate the client:

   ```bash
   npx prisma db execute --file prisma/migrations/<folder>/migration.sql --schema prisma/schema.prisma
   npx prisma generate
   ```

   > If you restore from a pre-2026-05-27 database dump, enum types will be lowercase — apply `prisma/migrations/20260527_fix_enum_type_casing/migration.sql` before starting the app.

6. **Seed the database _(optional)_.** Loads a snapshot of representative data (squads, people, clients, contracts, hour records, NB entries, sync logs). Safe to re-run — it deletes all rows first.

   ```bash
   npx prisma db seed
   ```

   > **Requires** `prisma/db-snapshot.json` (committed to the repo). The seed inserts raw `HourRecord` and `NonBillableEntry` rows but does not recompute derived summaries — after seeding, trigger an analytics refresh from the `/sync` page for the months you need.

7. **Start the dev server.**

   ```bash
   npm run dev
   ```

   The app is available at [http://localhost:3000](http://localhost:3000).

## Running tests

```bash
npm run test
```

This runs the Vitest suite (`vitest run`). Tests cover the database service and Jira-integration layers and use a mocked Prisma client, so **no running database is required**.

## Tech stack

| Layer              | Technology                                 | Version      |
| ------------------ | ------------------------------------------ | ------------ |
| Framework          | Next.js (App Router, TypeScript strict)    | 15.0.5       |
| Language           | TypeScript                                 | 5.7.2        |
| UI runtime         | React                                      | 18.3.1       |
| Styling            | Tailwind CSS + shadcn/ui (new-york)        | 3.4.19       |
| ORM                | Prisma → PostgreSQL 16                     | 5.22         |
| Data fetching      | TanStack Query + Axios                     | 5.62 / 1.7.9 |
| Forms & validation | react-hook-form + zod                      | 7.77 / 3.25  |
| Charts             | Recharts                                   | 3.8.1        |
| Toasts             | sonner                                     | 2.0.7        |
| Icons              | lucide-react                               | 0.468        |
| Theming            | next-themes (class-based dark mode)        | 0.4.6        |
| Spreadsheet export | SheetJS (`xlsx`)                           | 0.18.5       |
| Tests              | Vitest                                     | 4.1.9        |
| Deployment         | Firebase App Hosting + Cloud SQL (Node 20) | —            |

## Pages

- **`/` — Overview.** Delivery health for the selected month: contract-health counts (On Track / Underconsumption / Watch / Critical), open flags, active contracts, person and squad totals, and a per-contract consumption breakdown. A Getting Started checklist appears on a fresh install with no active clients.
- **`/burn` — Burn Rate.** Weekly cumulative burn per active contract: actual vs. expected pace with a pool-limit reference line and a pace alert. Only contracts with hours in the selected month appear.
- **`/consumption` — Consumption.** Contracted vs. actual utilization per contract and role — declared, prior-months consumed, consumed this month, remaining, and consumption %. Rows expand to a daily breakdown chart.
- **`/capacity` — Capacity.** Squad and role capacity against billable, non-billable, and available hours for the month, with By Squad / By Role views. Requires declarations and hour records for the month.
- **`/nonbillable` — Non-Billable.** NB totals, average NB %, people flagged, and open suggestions, with per-person and per-squad breakdowns and risk badges. Suggestions are auto-raised above 30% non-billable and don't auto-expire.
- **`/declarations` — Declarations.** Monthly role declarations grouped by client, showing contract, role, declared vs. consumed hours, and Draft / Confirmed status. Read-only here — editing happens in `/management`.
- **`/flags` — Flags.** Open anomaly flags (spike, underuse, pace risk, and more) with severity and explanation, plus a Suggestions tab. Flags can be dismissed or acknowledged.
- **`/simulator` — Simulator.** Model a proposed engagement and get a per-role feasibility check: available, or not available.
- **`/reports` — Reports.** Configurable hour-consumption reports across Clients, Persons, and Squads tabs with client-side XLSX export, built from the filters and columns you choose.
- **`/management` — Management.** Tabbed admin CRUD for clients, SOWs, contracts, Jira component mappings, squads, persons, memberships, roles, declarations, and non-billable categories and mappings. All deletes are soft (archival), never hard.
- **`/sync` — Sync.** Manually trigger a Jira data sync and an analytics refresh over a chosen date range, view last sync status per instance, and review the audit log. Sync is manual and runs per source.
- **`/help` — How to Use.** A guided, slide-by-slide product tour covering every page and the core Management setup workflows (client → SOW → contract → Jira mapping, non-billable mappings, squads and memberships, declarations vs. actual hours, and SOW renewal).
