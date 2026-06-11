# Contract Status & Consumption Criteria

Authoritative reference for how contract consumption, remaining hours, and
status badges are computed across the dashboard pages. These criteria were
agreed in the June 2026 consumption/capacity revision and are implemented in
`src/lib/analytics/contract-status.ts` plus the analytics API routes listed
below.

## Source of truth

- **Consumed hours** always come from `HourRecord` with `isNonBillable = false`
  (actual logged hours). Declarations are **planned** hours and are never
  counted as consumption.
- `MonthlyRoleDeclaration` / `DeclarationRoleEntry` only contribute the
  *declared pool* for monthly contracts (see below), never the consumed side.

## Contract hour types

`Contract.hourType` is `monthly` or `total`. The two follow different
consumption models:

### Monthly contracts (e.g. 200h/month)
- Each calendar month independently expects consumption of that month's
  declared hours.
- Declared pool for a month = sum of `DeclarationRoleEntry.declaredHours` for
  that contract+month; falls back to `Contract.assignedHours` when no
  declaration exists.
- Expected pace within the month is time-proportional (≈50h/week for a 200h
  month).
- "% consumed" is measured against that month's declared pool.

### Total contracts (e.g. 200h total pool)
- One pool (`Contract.assignedHours`) drawn down across the contract's
  lifetime. It **never resets** at a month boundary.
- Viewing month M: consumed = all billable hours from `startDate` through the
  end of M; remaining = pool − consumed-in-prior-months − consumed-in-M.
  Example: 200h total, 50h consumed in May → June shows 150h remaining.
- Remaining is **unclamped** — overruns show as negative.
- Declarations are ignored for the pool (they are planned hours, not pool).

## Expected pace

- **Basis: calendar days, prorated.** `expectedPaceFraction(periodStart,
  periodEnd, asOf)` = elapsed calendar days / total calendar days, clamped
  0..1.
- Current in-progress month: prorated to today (`asOf = min(today,
  monthEnd)`). Past months: full month (fraction 1). Future months: 0.
- Monthly contracts: period = the selected month.
- Total contracts **with** `endDate`: period = `startDate → endDate`
  (lifetime pace).
- Total contracts **without** `endDate`: **no pace classification** —
  absolute thresholds only (a contract can be watch/critical but never
  underconsumption).

## Overview taxonomy — contract health (4 statuses)

Used by the **/overview "Contract Status Breakdown"** card. Computed
server-side in `api/analytics/burn-by-contract/route.ts` via
`classifyContractStatus()`.

Precedence: **absolute thresholds first, then pace.** Thresholds override
pace — a contract at 92% consumed is critical even if on pace.

| Order | Status | Criteria |
|---|---|---|
| 1 | **critical** | ≥ 90% of pool consumed (`CRITICAL_THRESHOLD = 0.9`) |
| 2 | **watch** | ≥ 70% of pool consumed (`WATCH_THRESHOLD = 0.7`) |
| 3 | **underconsumption** | consumed < pool × expectedPct × 0.9 (i.e. more than 10% below expected pace, `PACE_TOLERANCE = 0.1`) |
| 4 | **on track** | everything else (within ±10% of pace, or no pace baseline) |

Pool definition per hour type:
- monthly → selected month's declared pool (declarations sum, fallback
  `assignedHours`); consumed = that month's hours.
- total → `assignedHours`; consumed = cumulative since `startDate`
  ("lifetime" numbers, labeled as such in the UI).

Zero-pool guard: `poolHours ≤ 0` → watch if any hours consumed, otherwise
on track (no divide-by-zero).

## Burn taxonomy — pace tracking (3 badges)

Used by **/burn**. Computed server-side in
`api/analytics/burn-by-contract-weekly/route.ts`.

`expectedToDate = pool × elapsedDays / totalDaysInMonth` (calendar days,
capped at month end). `ratio = consumed / expectedToDate`:

| Badge | Tone | Criteria |
|---|---|---|
| **Ahead of Pace** | critical | ratio > 1.1 (burning faster than expected) |
| **On Pace** | safe | 0.9 ≤ ratio ≤ 1.1 |
| **Behind Pace** | watch | ratio < 0.9 |

Guard: `expectedToDate = 0` (zero pool or month not started) → critical if
hours consumed, watch otherwise.

### ⚠️ Intentional divergence from the overview taxonomy

These two taxonomies use opposite semantics for "watch" **by design** — do
not unify them:

- **/overview watch** = high consumption (≥70% of pool) — risk of running out.
- **/burn watch** = *below* expected pace — risk of underdelivery.
- **/burn critical** = *above* pace, while **/overview critical** = ≥90%
  consumed.

Burn answers "are we burning at the planned rate?"; overview answers "how
close is the pool to exhaustion?". Both files carry a comment flagging this.

## Tolerance constants

All exported from `src/lib/analytics/contract-status.ts`:

| Constant | Value | Meaning |
|---|---|---|
| `CRITICAL_THRESHOLD` | 0.9 | ≥90% of pool → critical |
| `WATCH_THRESHOLD` | 0.7 | ≥70% of pool → watch |
| `PACE_TOLERANCE` | 0.1 | ±10% band around expected pace (underconsumption boundary on /overview, On Pace band on /burn) |

## Where each criterion is enforced

| Page | Computation | Files |
|---|---|---|
| /overview status breakdown | server | `src/lib/analytics/contract-status.ts`, `src/app/api/analytics/burn-by-contract/route.ts` |
| /burn pace badges | server | `src/app/api/analytics/burn-by-contract-weekly/route.ts` |
| /consumption remaining hours | server | `src/app/api/analytics/consumption-by-contract/route.ts` |

## Edge cases (agreed behavior)

- **Zero declared/pool hours**: no division — watch if consumed > 0, else
  on track.
- **Total contract, first month**: prior-months consumption = 0; remaining =
  pool − current month.
- **Future month selected**: expectedPct = 0 → never underconsumption;
  absolute thresholds still apply.
- **Archived contracts**: excluded — routes only consider `status: "active"`
  contracts whose date window covers the selected month.
- **Consumed = 0 with pace baseline**: classified underconsumption (below
  pace), not a special case.
