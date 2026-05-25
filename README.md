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

Cron routes live under `/api/admin/jobs/` and require the `X-Cron-Secret` header matching `CRON_SECRET` in `.env`.

| Route | Purpose |
|---|---|
| `POST /api/admin/jobs/analytics-refresh` | Recomputes all analytics for current + prior month |
| `POST /api/admin/jobs/sync` | Pulls latest data from Jira / Tempo |

Example:

```bash
curl -X POST http://localhost:3000/api/admin/jobs/analytics-refresh \
  -H "X-Cron-Secret: dev-secret-change-in-prod"
```
