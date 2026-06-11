# Business Rules (BR-1 … BR-11)

Authoritative domain rules for the client hierarchy, hour attribution, and
workforce constraints. 

## The rules and where they are enforced

### BR-1 — Client hierarchy
Client → SOW → Contract. A contract belongs to exactly one SOW; a SOW to
exactly one Client.
**Enforced by schema:** `Contract.sowId` and `StatementOfWork.clientId` are
required FKs (`prisma/schema.prisma`).

### BR-2 — Component binding
A Jira component maps to exactly one contract at a time (date-effective).
Components are the bridge from Jira worklogs to contracts.
**Enforced:** DB EXCLUDE `no_overlapping_component_mappings`
(`20260610160000` migration); mapping POSTs end-date the prior open mapping
(`api/management/components/route.ts`, `api/jira-component-mappings/route.ts`);
retargeting `contract_id` in place is blocked once hour records were
attributed through the mapping window (`api/management/components/[id]/route.ts`).

### BR-3 — Multi-squad membership
A person may hold multiple concurrent `SquadMembership` rows (split
allocations, different squads). Same-squad overlap is forbidden.
**Enforced:** EXCLUDE `no_overlapping_memberships` scoped per (person, squad)
(`20260610130000` migration).

### BR-4 — Single active role
One active `PersonRole` per person at any time.
**Enforced:** EXCLUDE `no_overlapping_roles` per person (`20260610130000`);
role POSTs end-date the prior open role in the same transaction.

### BR-5 — Client archival cascade
Archiving a client closes all non-closed contracts under its SOWs and
end-dates their open component mappings. SOW has **no status field by
design** — its activeness is derived (client active + not expired).
**Enforced:** cascade transaction in
`api/management/clients/[id]/archive/route.ts`. Unarchive restores the
client flag ONLY (prior contract states are unknowable); reopen contracts
explicitly if needed.

### BR-6 — SOW/contract expiry
When a SOW's or contract's `endDate` passes, the contract closes and its
mappings end-date. `endDate` is **inclusive** — a worklog dated ON the end
date is still valid.
**Enforced twice:** sync guard in `src/lib/integrations/jira-na.ts` skips
worklogs targeting a non-active contract, expired SOW, or archived client
(counted as conflict + `missing_data` AnomalyFlag); `runExpirySweep()` in
`src/lib/lifecycle.ts` runs before every sync and via
`POST /api/admin/jobs/expiry-sweep` (point an external Cloud Scheduler at
it nightly — there is no in-repo scheduler).

### BR-7 — Renewal creates new entities
Renewing a SOW never extends its `endDate`. Renewal = new SOW
(`parentSowId`) + successor contracts (`parentContractId`) + component
mappings split at the renewal boundary. Old entities remain as historical
records (contracts closed).
**Enforced:** `POST /api/management/statement-of-works/[id]/renew`.
Backdated worklogs still route to the old contract via mapping
date-effectiveness; current ones to the successor.

### BR-8 — HourRecord immutability
`HourRecord` attribution (`personId`, `squadId`, `clientId`, `contractId`,
`roleType`) is written once at sync and never changed retroactively. Fixes
must always be *prevention*, never row edits.
**Enforced:** snapshot writes in sync; contract DELETE refuses while hour
records reference it (the FK is `onDelete: SetNull` and deletion would null
ledger history — `api/management/contracts/[id]/route.ts`); membership/role
DELETEs refuse when hours exist in the row's window and end-date instead.

### BR-9 — Squad-change preservation
A person moving squads keeps all prior hours attributed to the old squad.
Follows from BR-8 + date-effective snapshot lookups keyed on worklog date.

### BR-10 — Multi-squad hour attribution
When a person has ≥2 active memberships on the worklog date, the squad
comes from `MonthlyRoleDeclaration` (base contract + worklog month →
squad; `@@unique([contractId, month])` guarantees at most one). If no
declaration exists, or the declared squad isn't one the person belongs to
on that date: **skip the worklog, count it in
`SyncLog.recordsConflicted`, raise a `missing_data` AnomalyFlag** — never
attribute by guess (highest allocation, most recent membership, etc.).
Re-sync after creating the declaration stores the record (externalRef
dedup makes this safe). Extension-rollover contracts look up the
declaration on the **base** contract. NB worklogs carry no contract and
use the first matching membership (documented limitation).
**Enforced:** `src/lib/integrations/jira-na.ts` (`processWorklogs`).

### BR-11 — Allocation sum ≤ 100%
Sum of `allocationPct` across a person's overlapping memberships can never
exceed 1.0 on any day — including future-dated ranges. The percentage is
relative; capacity-hour changes are `PersonCapacityHistory`'s concern.
**Enforced:** pl/pgsql constraint trigger `allocation_sum_check`
(`20260610150000` migration), serialized per person via advisory lock so
concurrent writes cannot jointly exceed 1.0. Routes map
`allocation_sum_exceeded` to 409.

## Approved design decisions (do not relitigate)

| Decision | Choice |
|---|---|
| BR-10 fallback when declaration missing | Skip + conflict + flag. NOT highest-allocation, NOT nullable squadId |
| Archival semantics | `Client.isActive=false` IS archived; no separate `isArchived` field; SOW has no status field |
| BR-6 trigger | Sync-time guard AND sweep (before each sync + external nightly scheduler) |
| BR-11 enforcement level | Hard DB trigger, not app-only validation |
| Contract→squad relationship | Via `MonthlyRoleDeclaration` per month; deliberately NO `Contract.squadId` FK |

## Operator notes

- Migrations apply via `npx prisma db execute --file ...` (never
  `prisma migrate dev`). The two constraint migrations
  (`20260610150000_allocation_sum_trigger`,
  `20260610160000_component_mapping_overlap_exclusion`) have **pre-apply
  data checks in their file headers** — run them against the target DB
  first; zero rows required.
- `SyncLog.recordsConflicted` = missing membership/role/mapping/declaration
  + inactive-target skips. `recordsSkipped` = externalRef dedup only.
