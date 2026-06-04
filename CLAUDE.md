# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run start        # Run production server
npm install          # Install deps + auto-generates Prisma client (postinstall hook)
```

**Database:**
```bash
docker compose up -d    # Start local Postgres 16
docker compose stop     # Stop without wiping data
docker compose down -v  # Destroy + wipe all data
npx prisma studio       # GUI for the DB
```

**Migrations — do NOT use `prisma migrate dev`.** The history contains hand-crafted DDL that Prisma cannot shadow-apply safely. Apply each pending migration directly:
```bash
npx prisma db execute --file prisma/migrations/<folder>/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

**Seed:**
```bash
npx prisma db seed
# Requires prisma/db-snapshot.json. Safe to run multiple times (deletes all rows first).
# After seeding, trigger analytics refresh via /sync page to populate derived summaries.
```

**Refresh DB snapshot from live data:**
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/extract-db.ts
```

## Architecture

Next.js 15 App Router. No Tailwind — uses CSS variables (`src/app/globals.css`). Path alias `@/*` → `src/*`. Deployed on Firebase App Hosting + Cloud SQL (Node 20, `apphosting.yaml`).

**Pages:**

| Route | Description |
|---|---|
| `/` | Overview dashboard — active clients, alert counts, gross margin, burn status |
| `/burn` | Weekly burn rate per client — cumulative vs expected, pool exhaustion projection |
| `/consumption` | Client retainer burn and T&E declarations |
| `/capacity` | Squad staffing gaps and commitment ratios |
| `/nonbillable` | NB hour summaries and enhancement suggestions |
| `/declarations` | Monthly role declarations — review, edit, confirm |
| `/flags` | Anomaly flags — review and resolve |
| `/simulator` | Model staffing changes and forecast impact |
| `/reports` | Hour-consumption reports (clients/persons/squads), XLSX export |
| `/management` | Admin CRUD for squads, persons, clients, mappings, contracts, billing rates |
| `/sync` | Manually trigger Jira sync and analytics refresh |

**Data flow:**
1. Cron jobs (`/api/admin/jobs/sync`) pull raw hours from Jira into `HourRecord` and `NonBillableEntry`
2. Analytics refresh (`/api/admin/jobs/analytics-refresh`) computes derived aggregates: `MonthlyConsumptionSummary`, `MonthlyNonBillableSummary`, `StaffingGapSnapshot`, `BurnSnapshot`, `AnomalyFlag`
3. Pages fetch analytics via TanStack Query → Axios → `/api/analytics/*` routes
4. Management CRUD goes through `/api/management/*`

**API prefix conventions:**
- `/api/analytics/*` — read-only analytics (used by dashboard pages)
- `/api/management/*` — full admin CRUD (used by `/management` page)
- `/api/reports/*` — report aggregations (persons/squads/clients tabs)
- `/api/admin/jobs/*` — sync and refresh triggers
- Older `/api/clients/*`, `/api/people/*`, `/api/squads/*` etc. — lighter read routes used by non-management pages

**Key source files:**
- `src/lib/prisma.ts` — singleton PrismaClient
- `src/lib/client.ts` — Axios instance + all client-side fetch functions
- `src/lib/integrations/jira-na.ts` — JiraNAConnector (Jira NA sync)
- `src/lib/analytics/refresh.ts` — analytics computation engine
- `src/app/layout.tsx` — root layout with sidebar nav and QueryClientProvider

**Reports** (`/reports`): do not run on load — require explicit Apply. Persons and squads tabs use `prisma.$queryRaw` for aggregations; clients tab uses Prisma ORM. XLSX export is client-side via SheetJS (no server round-trip).

## Schema invariants

**Financial immutability:** `HourRecord` stores five snapshot columns written once at sync time (`billingRateSnapshot`, `costRateSnapshot`, `currencySnapshot`, `billedAmountSnapshot`, `costAmountSnapshot`) and never updated. Analytics reads these instead of resolving live rates — financial reports stay stable if billing rates change retroactively.

**Soft deletes only:** No hard deletes anywhere. Archiving deactivates via `isActive`/`deactivatedAt`/`effectiveTo`.

**Audit ledgers:** Six append-only history models (`BillingRateHistory`, `ContractHistory`, `ContractExtensionHistory`, `MonthlyRoleDeclarationHistory`, `SquadMembershipHistory`, `StaffingGapSnapshotHistory`) record every state change with `changedAt`/`changedBy`.

**Guards enforced at API level:**
- Client currency is immutable once any `HourRecord` or `BillingRate` references the client (returns `400`)
- Squad `leadPersonId` must have an active `SquadMembership` for that squad (returns `400`)
- `PersonCalendarAssignment`: partial unique index enforces at most one open-ended row per person

**Enum naming:** All PostgreSQL enum types use camelCase (e.g. `"ContractStatus"`, `"Currency"`). Pre-2026-05-27 dumps have lowercase types — apply `prisma/migrations/20260527_fix_enum_type_casing/migration.sql` before starting.

## No tests

No jest/vitest/playwright config exists. No test suites in the repo.
