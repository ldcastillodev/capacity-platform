# Schema Audit — Capacity Platform

## 1. Executive Summary

Severity-ranked. Each item: problem → impact.

### Critical
1. **`Person.costPerHour` duplicates `CostRate`** — two sources of truth for the same financial value. A raise updates `Person.costPerHour` but historical `HourRecord` rows recompute margins against the new value, silently corrupting `MonthlyConsumptionSummary.directCost`.
2. **`HourRecord` has no rate snapshot** — every report dynamically resolves `BillingRate`/`CostRate` by `(client, role, date)` lookup. Any retroactive edit to a rate row's `effectiveTo` or `ratePerHour` rewrites prior period revenue/cost figures.
3. **`MonthlyRoleDeclaration` allows `contractId` AND `extensionId` both NULL or both set** — declarations can be orphaned from any budget source or double-attributed. Reports lose deterministic provenance.
4. **`HourRecord` polymorphic budget FKs uncontrolled** — `budgetSource` discriminator is not enforced against the three nullable FK columns. A row with `budgetSource='te'` can have NULL `contractExtensionId`, producing untraceable hours.
5. **`StaffingGapSnapshot` reads mutable `Person.weeklyCapacityHours`** — historical gap calculations drift whenever a person's capacity changes (part-time ↔ full-time). Past snapshots cannot be reproduced.
6. **No history ledgers** — `MonthlyRoleDeclaration`, `ChangeOrder`, `ContractExtension`, `SMEEngagement`, `RetainerContract` all mutable in place. Audit trail lost on every edit; no point-in-time reconstruction possible.

### High
7. **`CostRate` allows both `personId` AND `roleType` NULL** — meaningless rows possible. Unique key never collides because two NULLs are unique in Postgres.
8. **`ClientPersonAccess` unique `(clientId, personId)`** — blocks re-grant after revoke. Operationally users get re-onboarded; current schema requires DELETE then INSERT, losing revocation history.
9. **`Squad.leadPersonId` lead-must-be-member rule unenforced** — leads can be assigned from outside squad membership.
10. **`PersonRole.isPrimary` allows multiple primaries per person** — primary role lookup is non-deterministic.
11. **`JiraComponentClientMapping` unique omits `jiraInstance`** — same `componentKey` across NA/EMEA Jira instances collides.
12. **`SMEEngagement.source='internal_other_squad'` allows NULL `personId`** — internal engagements must reference a known `Person`; constraint missing.
13. **`MonthlyConsumptionSummary.directCost` recomputed from mutable rates** — same root cause as #2. Cannot reproduce prior period margins.
14. **`TEBillingConfig` mutable downstream of approved `ContractExtension`** — extension rate resolves at report time from a mutable parent table. Past extensions silently re-rate.

### Medium
15. **Missing compound indexes on documented hot reporting paths** — see §3.
16. **`SyncLog.unmappedRefs` and `errorMessage` text fields unbounded** — table grows indefinitely with large payloads.
17. **`NonBillableCategory.type` mutable** — recategorizing a category retroactively reassigns the type of every historical `NonBillableEntry`. Must be treated as immutable lookup.
18. **`RoleCascadeRule.ratio` mutability** — safe only if pipeline writes resolved ratio into `StaffingGapSnapshot` at compile time; not verifiable from schema alone.
19. **`HolidayCalendar` missing `(region, name)` unique** — duplicate calendars possible.
20. **`PersonCalendarAssignment` missing `effectiveTo`** — overlapping active assignments per person allowed; "active calendar at date X" is ambiguous.
21. **`AnomalyFlag` allows duplicate detections per `(clientId, month, flagType, roleType, detectorVersion)`** — detector reruns insert duplicates.
22. **`Client.currency` mutable** — `BillingRate` rows in mixed currencies break reports if changed mid-flight.

### Low
23. **`SyncLog.syncType` is `VarChar(20)`** — should be enum for type safety; values are finite.
24. **`NonBillableSourceMapping.identifierType` is `VarChar(50)`** — finite domain, candidate for enum.
25. **Missing `updatedAt` on `SMEEngagement`, `ContractExtension`, `MonthlyRoleDeclaration`** — mutable tables lacking change timestamps.
26. **`HolidayCalendar.region` is `VarChar(50)` not the `Region` enum** — inconsistent with `Client.region`. Likely intentional (country-level calendars) — confirm.
27. **`ContractExtension.roleType` semantics undocumented in schema** — NULL = "all roles" per business rule; add comment or rename for clarity.

---

## 2. Model-by-Model Critique

### Squad

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | `id`, `name`, `isActive`, `createdAt`, `@@map` | Sound. |
| CHANGE | `leadPersonId` | Add app-layer invariant: lead must exist in `SquadMembership` for the same squad with current effective range. Document, optionally enforce via trigger. |
| ADD | `updatedAt @updatedAt` | Mutable row, no change timestamp. |

### Person

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | `id`, `name`, `email`, `employmentType`, `isActive`, `tempoAccountId`, `createdAt` | Sound. |
| DELETE | `costPerHour` | Duplicates `CostRate`. Single source of truth violated. |
| CHANGE | `weeklyCapacityHours` | Keep as current-state. Snapshot tables must denormalize capacity at calculation time (see `StaffingGapSnapshot`). |
| ADD | `updatedAt @updatedAt` | Mutable row. |

### SquadMembership

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields and `@@unique([personId, squadId, effectiveFrom])` | Bitemporal pattern correct. |
| ADD | App-layer: serializable transaction enforcing `SUM(allocationPct)` across active rows ≤ 1.0 | DB cannot validate cross-row sums cleanly. |

### PersonRole

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Fields and `(personId, roleType)` index | Sound. |
| ADD | Partial unique: `CREATE UNIQUE INDEX uq_primary_role_per_person ON person_roles (person_id) WHERE is_primary = true AND effective_to IS NULL` | One active primary per person. |

### Client

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Fields and `@@map` | Sound. |
| CHANGE | `currency` | Block mutation at app layer post-creation; or move to `BillingRate` row exclusively. |
| ADD | `updatedAt @updatedAt`. |

### ClientPersonAccess

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Fields. |
| DELETE | `@@unique([clientId, personId])` | Blocks re-grant after revoke. |
| ADD | Partial unique: `CREATE UNIQUE INDEX uq_active_client_person_access ON client_person_access (client_id, person_id) WHERE revoked_at IS NULL`. |

### SquadCapacityConfig

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Snapshot tables must denormalize buffer pcts at calculation time. |

### RoleCascadeRule

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Pipeline must write resolved cascade output into `StaffingGapSnapshot` at compile time. |

### HolidayCalendar

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Fields. |
| ADD | `@@unique([region, name])` — dedupe lookups. |

### HolidayEntry

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

### PersonCalendarAssignment

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | `id`, `personId`, `calendarId`, `effectiveFrom`. |
| ADD | `effectiveTo DateTime? @db.Date` — close temporal interval. |
| ADD | `@@unique([personId, effectiveFrom])` — one assignment start per person per date. |

### RetainerContract

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Fields and `(clientId, status)` index. |
| ADD | Sibling model `ContractAmendment` — additive ledger of `totalPoolHours` changes with `effectiveFrom`, `previousValue`, `newValue`, `changedBy`, `reason`. Resolver computes effective pool by summing/picking latest amendment per date. Avoids row versioning churn. |

### MonthlyRoleDeclaration

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Most fields and all current indexes. |
| ADD | `updatedAt @updatedAt`. |
| ADD | CHECK constraint: `(contract_id IS NOT NULL AND extension_id IS NULL) OR (contract_id IS NULL AND extension_id IS NOT NULL)`. |
| ADD | Sibling `MonthlyRoleDeclarationHistory` — append-only ledger of mutations (old/new declaredHours, status, actor, timestamp). |
| ADD | Index `(clientId, month, status)` — dashboard filter. |

### BillingRate

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Resolver in app layer cascades `(clientId, roleType, date)` → `(clientId, NULL, date)`. |

### CostRate

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields. |
| ADD | CHECK: `person_id IS NOT NULL OR role_type IS NOT NULL` — block meaningless rows. |
| ADD | Missing relation back to `Person` (currently no `@relation` declared). Confirms FK integrity. |

### TEBillingConfig / TEBillingRoleRate

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields and unique constraints. |
| CHANGE | Resolution flow: when `ContractExtension.status → approved`, denormalize resolved rate(s) into a new `ContractExtension.resolvedRate Decimal` + `ContractExtension.resolvedCurrency Currency` column. Past extensions never re-rate. |

### ContractExtension

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Most fields and `(clientId, month)` index. |
| ADD | `resolvedRate Decimal? @db.Decimal(10,4)`, `resolvedCurrency Currency?` — populated at approval. |
| ADD | `updatedAt @updatedAt`. |
| ADD | Sibling `ContractExtensionHistory` ledger. |

### ChangeOrder / ChangeOrderLineItem

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All current fields and unique constraint on line items. |
| ADD | `ChangeOrderHistory` + `ChangeOrderLineItemHistory` ledgers — capture hours/rateOverride/status mutations. |

### SMEEngagement

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields. |
| ADD | CHECK: `(source = 'internal_other_squad' AND person_id IS NOT NULL) OR (source = 'external_contractor')`. |
| ADD | `updatedAt @updatedAt`. |
| ADD | `SMEEngagementHistory` ledger — capture billingRate/costRate/status changes. |

### HourRecord

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Most fields and existing indexes. |
| ADD | CHECK enforcing budget polymorphism: `(budget_source='retainer' AND contract_extension_id IS NULL AND change_order_id IS NULL AND sme_engagement_id IS NULL) OR (budget_source='te' AND contract_extension_id IS NOT NULL AND ...) OR ...`. |
| ADD | `billingRateSnapshot Decimal @db.Decimal(10,4)`, `costRateSnapshot Decimal @db.Decimal(10,4)`, `currencySnapshot Currency`, `billedAmountSnapshot Decimal @db.Decimal(12,4)`, `costAmountSnapshot Decimal @db.Decimal(12,4)` — denormalize at write. Reports never re-resolve historical rates. |
| ADD | Index `(clientId, date, budgetSource)` — primary dashboard filter. |

### NonBillableCategory

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields. |
| ADD | `isActive Boolean @default(true)` + `deactivatedAt DateTime?` — soft-delete pattern. New categorization = new row, never mutate `type`. App layer blocks `type` mutation post-creation. |

### NonBillableEntry

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields and both existing indexes (`personId, date`), (`squadId, date`). |

### NonBillableSourceMapping

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |
| OPTIONAL | Convert `source` and `identifierType` to enums — finite domain, type safety. |

### TempoAccountClientMapping

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

### JiraComponentClientMapping

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields. |
| CHANGE | Replace `@@unique([componentKey, effectiveFrom])` with `@@unique([jiraInstance, componentKey, effectiveFrom])` — cross-instance collision fix. |

### SyncLog

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Most fields. |
| ADD | Index `(source, startedAt DESC)` — admin dashboard sort. |
| ADD | Retention job: NULL out `unmappedRefs` and `errorMessage` for rows older than 90 days; preserve row metadata. |
| OPTIONAL | Convert `syncType` from `VarChar(20)` to enum. |

### StaffingGapSnapshot

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | Most fields, unique + index. |
| ADD | `capacityHoursAtTime Decimal @db.Decimal(8,2)` — denormalize squad capacity at calculation time. |
| ADD | `hardBufferPctAtTime Decimal @db.Decimal(5,4)`, `softBufferPctAtTime Decimal @db.Decimal(5,4)` — freeze buffer policy used. |
| ADD | `cascadeRuleVersionAtTime VarChar(50)` or store resolved cascade output — freeze cascade ratios used. |

### MonthlyConsumptionSummary

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields and indexes. |
| CHANGE | Refresh logic must aggregate from `HourRecord` snapshot columns, not live-resolve rates. |

### WeeklyBurnSnapshot

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields and unique. |
| ADD | Index `(clientId, weekStart, alertLevel)` — operational alert dashboard. |

### CeremonyAttribution

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound — already denormalizes inputs at calc time. |

### AnomalyFlag

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields, `(clientId, month)` index. |
| ADD | `@@unique([clientId, month, flagType, roleType, detectorVersion])` — dedupe detector reruns. |

### MonthlyNonBillableSummary

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

### NonBillableEnhancementSuggestion

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

### MonthlyCeremonyAllocation

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

### ClientSimulation

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All fields. |
| ADD | Index `(clientId, createdAt DESC)` — recent simulations per client. |

### ClientSimulationLineItem

| Action | Field / Rule | Rationale |
|---|---|---|
| KEEP | All. Sound. |

---

## 3. Query Performance Bottlenecks

### Q1. Client overview for month X (dashboard primary)
Shape:
```sql
SELECT date_trunc('month', date), budget_source, SUM(hours), SUM(billed_amount_snapshot), SUM(cost_amount_snapshot)
FROM hour_records
WHERE client_id = $1 AND date >= $2 AND date < $3
GROUP BY 1, 2;
```
Why slow today: only `(clientId, date)` exists. `budgetSource` filter / grouping requires extra row scan after index seek.
Fix:
```prisma
@@index([clientId, date, budgetSource])
```

### Q2. Squad utilization for month — billable vs non-billable
Shape:
```sql
SELECT person_id, SUM(hours) FROM nonbillable_entries
WHERE squad_id = $1 AND date >= $2 AND date < $3
GROUP BY person_id;
```
Existing `(squadId, date)` covers seek. Sound. No change.

### Q3. Burn projection across active clients
Shape:
```sql
SELECT * FROM weekly_burn_snapshots
WHERE alert_level IN ('warning','critical') AND week_start = (SELECT MAX(week_start) FROM weekly_burn_snapshots);
```
Why slow today: no index covers `alert_level`. Full scan of latest week.
Fix:
```prisma
@@index([weekStart, alertLevel])
@@index([clientId, weekStart, alertLevel])
```

### Q4. Anomaly inbox for client + month
Shape:
```sql
SELECT * FROM anomaly_flags
WHERE client_id = $1 AND month = $2 AND resolved_at IS NULL
ORDER BY severity DESC, detected_at DESC;
```
Why slow: existing `(clientId, month)` covers seek; severity/resolved filter is post-scan.
Fix: partial index for active flags:
```sql
CREATE INDEX idx_anomaly_active ON anomaly_flags (client_id, month, severity) WHERE resolved_at IS NULL;
```

### Q5. Declaration status board (squad + month + status)
Shape:
```sql
SELECT * FROM monthly_role_declarations
WHERE client_id = $1 AND month = $2 AND status IN ('draft','confirmed');
```
Existing `(clientId, month)` exists; status post-filter cheap at low cardinality. Add only if scale demands:
```prisma
@@index([clientId, month, status])
```

### Q6. Sync admin: latest runs per source
Shape:
```sql
SELECT * FROM sync_logs WHERE source = $1 ORDER BY started_at DESC LIMIT 50;
```
Fix:
```prisma
@@index([source, startedAt(sort: Desc)])
```

---

## 4. Step-by-Step Execution Plan

### Phase 2.1 — Non-breaking structural fixes

Pre-prod, app-only writers, no rollback concern. Run these first. Order matters where new columns are referenced.

1. **Add denormalized snapshot columns on `HourRecord`** (NULL-able initially; backfill; then NOT NULL):
   ```prisma
   model HourRecord {
     billingRateSnapshot   Decimal  @map("billing_rate_snapshot")   @db.Decimal(10, 4)
     costRateSnapshot      Decimal  @map("cost_rate_snapshot")      @db.Decimal(10, 4)
     currencySnapshot      Currency @map("currency_snapshot")
     billedAmountSnapshot  Decimal  @map("billed_amount_snapshot")  @db.Decimal(12, 4)
     costAmountSnapshot    Decimal  @map("cost_amount_snapshot")    @db.Decimal(12, 4)
   }
   ```
   Backfill: write script that joins `HourRecord → BillingRate/CostRate` resolver and fills snapshot fields. Then mark NOT NULL.

2. **Add denormalized columns on `StaffingGapSnapshot`**:
   ```prisma
   model StaffingGapSnapshot {
     capacityHoursAtTime  Decimal @map("capacity_hours_at_time")   @db.Decimal(8, 2)
     hardBufferPctAtTime  Decimal @map("hard_buffer_pct_at_time")  @db.Decimal(5, 4)
     softBufferPctAtTime  Decimal @map("soft_buffer_pct_at_time")  @db.Decimal(5, 4)
   }
   ```
   Backfill from current `Person.weeklyCapacityHours` + `SquadCapacityConfig` values.

3. **Add `resolvedRate` + `resolvedCurrency` on `ContractExtension`**:
   ```prisma
   model ContractExtension {
     resolvedRate     Decimal?  @map("resolved_rate")     @db.Decimal(10, 4)
     resolvedCurrency Currency? @map("resolved_currency")
     updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")
   }
   ```
   Application change: populate on transition to `approved`.

4. **Add CHECK constraints (raw SQL migrations)**:
   ```sql
   ALTER TABLE monthly_role_declarations
     ADD CONSTRAINT chk_declaration_source CHECK (
       (contract_id IS NOT NULL AND extension_id IS NULL)
       OR (contract_id IS NULL AND extension_id IS NOT NULL)
     );

   ALTER TABLE hour_records ADD CONSTRAINT chk_hour_budget_source CHECK (
     (budget_source = 'retainer'      AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
     (budget_source = 'te'            AND contract_extension_id IS NOT NULL AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
     (budget_source = 'change_order'  AND contract_extension_id IS NULL     AND change_order_id IS NOT NULL AND sme_engagement_id IS NULL) OR
     (budget_source = 'sme'           AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NOT NULL)
   );

   ALTER TABLE cost_rates ADD CONSTRAINT chk_rate_identity
     CHECK (person_id IS NOT NULL OR role_type IS NOT NULL);

   ALTER TABLE sme_engagements ADD CONSTRAINT chk_sme_source_data CHECK (
     (source = 'internal_other_squad' AND person_id IS NOT NULL)
     OR (source = 'external_contractor')
   );
   ```

5. **Add missing `updatedAt` columns**:
   ```prisma
   model Person              { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   model Squad               { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   model Client              { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   model SMEEngagement       { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   model ContractExtension   { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   model MonthlyRoleDeclaration { updatedAt DateTime @default(now()) @updatedAt @map("updated_at") }
   ```

6. **Add `effectiveTo` on `PersonCalendarAssignment`**:
   ```prisma
   model PersonCalendarAssignment {
     effectiveTo DateTime? @map("effective_to") @db.Date
     @@unique([personId, effectiveFrom])
   }
   ```

7. **Add `@@unique([region, name])` on `HolidayCalendar`**:
   ```prisma
   model HolidayCalendar {
     @@unique([region, name])
   }
   ```

8. **Add CostRate ↔ Person relation** (currently missing in schema):
   ```prisma
   model Person {
     costRates CostRate[]
   }
   model CostRate {
     person Person? @relation(fields: [personId], references: [id])
   }
   ```

9. **Add history ledger models** (additive, no breaking change to parents):
   ```prisma
   model MonthlyRoleDeclarationHistory {
     id              Int               @id @default(autoincrement())
     declarationId   Int               @map("declaration_id")
     changedAt       DateTime          @default(now()) @map("changed_at")
     changedBy       Int?              @map("changed_by")
     prevDeclaredHours Decimal?        @map("prev_declared_hours") @db.Decimal(8, 2)
     newDeclaredHours  Decimal?        @map("new_declared_hours")  @db.Decimal(8, 2)
     prevStatus      DeclarationStatus? @map("prev_status")
     newStatus       DeclarationStatus? @map("new_status")
     reason          String?
     @@index([declarationId, changedAt])
     @@map("monthly_role_declaration_history")
   }

   model ContractAmendment {
     id              Int      @id @default(autoincrement())
     contractId      Int      @map("contract_id")
     effectiveFrom   DateTime @map("effective_from") @db.Date
     prevPoolHours   Decimal  @map("prev_pool_hours") @db.Decimal(8, 2)
     newPoolHours    Decimal  @map("new_pool_hours")  @db.Decimal(8, 2)
     reason          String?
     changedBy       Int?     @map("changed_by")
     createdAt       DateTime @default(now()) @map("created_at")
     @@index([contractId, effectiveFrom])
     @@map("contract_amendments")
   }

   model ContractExtensionHistory {
     id               Int              @id @default(autoincrement())
     extensionId      Int              @map("extension_id")
     changedAt        DateTime         @default(now()) @map("changed_at")
     changedBy        Int?             @map("changed_by")
     prevStatus       ExtensionStatus? @map("prev_status")
     newStatus        ExtensionStatus? @map("new_status")
     prevRequestedHours Decimal?       @map("prev_requested_hours") @db.Decimal(8, 2)
     newRequestedHours  Decimal?       @map("new_requested_hours")  @db.Decimal(8, 2)
     prevRateOverride Decimal?         @map("prev_rate_override")   @db.Decimal(10, 4)
     newRateOverride  Decimal?         @map("new_rate_override")    @db.Decimal(10, 4)
     @@index([extensionId, changedAt])
     @@map("contract_extension_history")
   }

   model ChangeOrderHistory { /* mirror ChangeOrder mutable fields */ }
   model ChangeOrderLineItemHistory { /* mirror line item fields */ }
   model SMEEngagementHistory { /* mirror billingRate/costRate/status/contractedHours */ }
   ```

10. **`NonBillableCategory` immutability**:
    ```prisma
    model NonBillableCategory {
      isActive       Boolean   @default(true) @map("is_active")
      deactivatedAt  DateTime? @map("deactivated_at")
    }
    ```
    App layer: block `UPDATE` on `type` once row created. New type = new row.

### Phase 2.2 — Index optimization

Apply after structural changes. Indexes can be added concurrently without downtime even in production; here, pre-prod, run inline.

```prisma
model HourRecord {
  @@index([clientId, date, budgetSource])           // Q1
}

model WeeklyBurnSnapshot {
  @@index([clientId, weekStart, alertLevel])         // Q3
  @@index([weekStart, alertLevel])                   // Q3 fleet-wide alert view
}

model AnomalyFlag {
  @@unique([clientId, month, flagType, roleType, detectorVersion], name: "uq_anomaly_dedupe")
}

model MonthlyRoleDeclaration {
  @@index([clientId, month, status])                 // Q5
}

model SyncLog {
  @@index([source, startedAt])                       // Q6
}

model ClientSimulation {
  @@index([clientId, createdAt])
}
```

Raw partial indexes:
```sql
CREATE UNIQUE INDEX uq_active_client_person_access
  ON client_person_access (client_id, person_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX uq_primary_role_per_person
  ON person_roles (person_id) WHERE is_primary = true AND effective_to IS NULL;

CREATE INDEX idx_anomaly_active
  ON anomaly_flags (client_id, month, severity) WHERE resolved_at IS NULL;
```

### Phase 2.3 — Architectural refactoring (breaking changes)

Pre-prod, so safe to land. Each step is independent.

1. **Drop `Person.costPerHour`**:
   ```prisma
   // remove field from Person model
   ```
   ```sql
   ALTER TABLE persons DROP COLUMN cost_per_hour;
   ```
   Replace all reader call sites with `CostRate` resolver (preferring `HourRecord.costRateSnapshot` for historical reads after backfill in 2.1).

2. **Drop `@@unique([clientId, personId])` on `ClientPersonAccess`**, replaced by partial unique in 2.2:
   ```sql
   ALTER TABLE client_person_access DROP CONSTRAINT client_person_access_client_id_person_id_key;
   ```
   (Partial unique `uq_active_client_person_access` already created in 2.2.)

3. **Refactor `JiraComponentClientMapping` unique**:
   ```prisma
   model JiraComponentClientMapping {
     @@unique([jiraInstance, componentKey, effectiveFrom])
   }
   ```
   ```sql
   ALTER TABLE jira_component_client_mappings
     DROP CONSTRAINT jira_component_client_mappings_component_key_effective_from_key,
     ADD CONSTRAINT uq_jira_mapping UNIQUE (jira_instance, component_key, effective_from);
   ```

4. **Migrate `RetainerContract.totalPoolHours` mutations to `ContractAmendment` ledger**:
   - Backfill: insert an initial `ContractAmendment` row per existing `RetainerContract` capturing the as-is `totalPoolHours` at `validFrom`.
   - Application: pool-resolver reads from amendments; UI writes append-only.
   - `RetainerContract.totalPoolHours` becomes the cached current value; trigger or service updates on amendment insert.

5. **Denormalize TE rate resolution into `ContractExtension`** (column already added in 2.1):
   - Update the approval workflow: on transition to `approved`, compute and persist `resolvedRate` + `resolvedCurrency` from `TEBillingConfig` + `TEBillingRoleRate`.
   - Backfill all currently-approved extensions.
   - Reports read `ContractExtension.resolvedRate` directly; `TEBillingConfig` becomes prospective-only.

6. **Optional enum tightening** (low priority):
   ```prisma
   enum SyncType {
     hour_records
     non_billable
     mappings
   }
   model SyncLog { syncType SyncType @map("sync_type") }
   ```
   Plus `NonBillableSourceMapping.source` / `identifierType` to enums if domains are stable.

7. **`Client.currency` immutability** — app-layer guard. No schema change required; document in service layer:
   - Block PATCH on `Client.currency` once any `BillingRate` / `HourRecord` references the client.

8. **`Squad.leadPersonId` membership invariant** — app-layer guard or DB trigger:
   ```sql
   CREATE FUNCTION assert_lead_is_member() RETURNS trigger AS $$
   BEGIN
     IF NEW.lead_person_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM squad_memberships
       WHERE squad_id = NEW.id AND person_id = NEW.lead_person_id
         AND effective_from <= CURRENT_DATE
         AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ) THEN
       RAISE EXCEPTION 'Squad lead must be a current squad member';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_squad_lead_member BEFORE INSERT OR UPDATE ON squads
     FOR EACH ROW EXECUTE FUNCTION assert_lead_is_member();
   ```

9. **Snapshot tables refresh logic** — application change (no schema):
   - `MonthlyConsumptionSummary` aggregator must sum `HourRecord.billedAmountSnapshot` / `costAmountSnapshot`, not re-resolve `BillingRate` / `CostRate` live.
   - `StaffingGapSnapshot` writer must populate `capacityHoursAtTime` / `hardBufferPctAtTime` / `softBufferPctAtTime` from current values at compile time, never read mutable parent rows during reporting.

### Execution order summary

| Step | Action | Type | Phase |
|---|---|---|---|
| 1 | Add snapshot columns (HourRecord, StaffingGapSnapshot, ContractExtension) | Additive | 2.1 |
| 2 | Backfill snapshot columns | Data | 2.1 |
| 3 | Add CHECK constraints | Additive | 2.1 |
| 4 | Add updatedAt columns | Additive | 2.1 |
| 5 | Add PersonCalendarAssignment.effectiveTo + unique | Additive | 2.1 |
| 6 | Add HolidayCalendar unique | Additive | 2.1 |
| 7 | Add CostRate ↔ Person relation | Additive | 2.1 |
| 8 | Add history ledger models | Additive | 2.1 |
| 9 | NonBillableCategory soft-delete columns | Additive | 2.1 |
| 10 | Add compound + partial indexes | Index | 2.2 |
| 11 | Add AnomalyFlag dedupe unique | Index | 2.2 |
| 12 | Drop Person.costPerHour | Breaking | 2.3 |
| 13 | Drop ClientPersonAccess unique | Breaking | 2.3 |
| 14 | Refactor JiraComponentClientMapping unique | Breaking | 2.3 |
| 15 | Backfill ContractAmendment, switch readers | Breaking | 2.3 |
| 16 | Populate ContractExtension.resolvedRate, switch readers | Breaking | 2.3 |
| 17 | Enum tightening (optional) | Breaking | 2.3 |
| 18 | App-layer guards (Client.currency, Squad.leadPersonId, NonBillableCategory.type) | App | 2.3 |
| 19 | Snapshot refresh logic update | App | 2.3 |
