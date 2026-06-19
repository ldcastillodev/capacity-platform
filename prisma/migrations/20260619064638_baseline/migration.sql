-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('dev', 'devops', 'qa', 'data', 'design', 'product', 'project', 'tl', 'sre', 'seo', 'content');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('emea', 'na');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GBP', 'EUR');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "HourType" AS ENUM ('monthly', 'total');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('base', 'change_order', 'extension');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('jira_na', 'jira_emea');

-- CreateEnum
CREATE TYPE "SyncConflictCategory" AS ENUM ('missing_mapping', 'missing_membership', 'missing_role', 'missing_declaration', 'inactive_target');

-- CreateEnum
CREATE TYPE "NonBillableType" AS ENUM ('shared_ceremony', 'leave', 'internal_meeting', 'training', 'company');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('safe', 'watch', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AnomalyFlagType" AS ENUM ('spike', 'underuse', 'pace_risk', 'underburn_risk', 'role_substitution', 'missing_data');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('declaration_adjustment', 'pto_capacity_warning', 'ceremony_overhead', 'nonbillable_trend');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'acknowledged', 'applied', 'dismissed');

-- CreateEnum
CREATE TYPE "NbMappingSource" AS ENUM ('jira_na', 'jira_emea');

-- CreateEnum
CREATE TYPE "NbIdentifierType" AS ENUM ('issue_key', 'component_key');

-- CreateTable
CREATE TABLE "squads" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "lead_person_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_capacity_history" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "person_capacity_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_memberships" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "allocation_pct" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "squad_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_roles" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "seniority" "Seniority",
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "person_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "region" "Region" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements_of_work" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "parent_sow_id" INTEGER,

    CONSTRAINT "statements_of_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sow_id" INTEGER NOT NULL,
    "hour_type" "HourType" NOT NULL,
    "type" "ContractType" NOT NULL,
    "assigned_hours" DECIMAL(8,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "parent_contract_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_role_declarations" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'draft',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_role_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_role_entries" (
    "id" SERIAL NOT NULL,
    "declaration_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "declared_hours" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "declaration_role_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_records" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "contract_id" INTEGER,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "role_type" "RoleType",
    "source" "SyncSource" NOT NULL,
    "is_non_billable" BOOLEAN NOT NULL DEFAULT false,
    "nonbillable_category_id" INTEGER,
    "external_ref" VARCHAR(300),
    "issue_key" VARCHAR(50),
    "archived_at" TIMESTAMP(3),
    "archive_reason" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hour_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonbillable_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "NonBillableType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "nonbillable_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonbillable_source_mappings" (
    "id" SERIAL NOT NULL,
    "source" "NbMappingSource" NOT NULL,
    "identifier_type" "NbIdentifierType" NOT NULL,
    "identifier_value" VARCHAR(200) NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "nonbillable_source_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_component_client_mappings" (
    "id" SERIAL NOT NULL,
    "jira_instance" VARCHAR(10) NOT NULL DEFAULT 'na',
    "component_key" VARCHAR(200) NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "jira_component_client_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "source" "SyncSource" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "date_from" TIMESTAMP(3),
    "date_to" TIMESTAMP(3),
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "records_conflicted" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" SERIAL NOT NULL,
    "source" "SyncSource" NOT NULL,
    "external_ref" TEXT NOT NULL,
    "category" "SyncConflictCategory" NOT NULL,
    "author_email" TEXT,
    "issue_key" TEXT,
    "component_key" TEXT,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "detail" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_flags" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER,
    "month" DATE NOT NULL,
    "role_type" "RoleType",
    "flag_type" "AnomalyFlagType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "detector_version" VARCHAR(50) NOT NULL DEFAULT 'rules_v1',
    "explanation" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,
    "resolution_notes" TEXT,

    CONSTRAINT "anomaly_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonbillable_enhancement_suggestions" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER,
    "squad_id" INTEGER,
    "month" DATE NOT NULL,
    "suggestion_type" "SuggestionType" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "explanation" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "suggested_hours" DECIMAL(8,2),
    "current_hours" DECIMAL(8,2),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,

    CONSTRAINT "nonbillable_enhancement_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "squads_name_key" ON "squads"("name");

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE INDEX "person_capacity_history_person_id_idx" ON "person_capacity_history"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_capacity_history_person_id_effective_from_key" ON "person_capacity_history"("person_id", "effective_from");

-- CreateIndex
CREATE INDEX "squad_memberships_squad_id_idx" ON "squad_memberships"("squad_id");

-- CreateIndex
CREATE UNIQUE INDEX "squad_memberships_person_id_squad_id_effective_from_key" ON "squad_memberships"("person_id", "squad_id", "effective_from");

-- CreateIndex
CREATE INDEX "person_roles_person_id_role_type_idx" ON "person_roles"("person_id", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "person_roles_person_id_role_type_effective_from_key" ON "person_roles"("person_id", "role_type", "effective_from");

-- CreateIndex
CREATE INDEX "statements_of_work_client_id_idx" ON "statements_of_work"("client_id");

-- CreateIndex
CREATE INDEX "statements_of_work_parent_sow_id_idx" ON "statements_of_work"("parent_sow_id");

-- CreateIndex
CREATE INDEX "contracts_sow_id_status_idx" ON "contracts"("sow_id", "status");

-- CreateIndex
CREATE INDEX "contracts_parent_contract_id_idx" ON "contracts"("parent_contract_id");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_client_id_month_idx" ON "monthly_role_declarations"("client_id", "month");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_squad_id_month_idx" ON "monthly_role_declarations"("squad_id", "month");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_client_id_month_status_idx" ON "monthly_role_declarations"("client_id", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_role_declarations_contract_id_month_key" ON "monthly_role_declarations"("contract_id", "month");

-- CreateIndex
CREATE INDEX "declaration_role_entries_declaration_id_idx" ON "declaration_role_entries"("declaration_id");

-- CreateIndex
CREATE UNIQUE INDEX "declaration_role_entries_declaration_id_role_type_key" ON "declaration_role_entries"("declaration_id", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "hour_records_external_ref_key" ON "hour_records"("external_ref");

-- CreateIndex
CREATE INDEX "hour_records_client_id_date_idx" ON "hour_records"("client_id", "date");

-- CreateIndex
CREATE INDEX "hour_records_person_id_date_idx" ON "hour_records"("person_id", "date");

-- CreateIndex
CREATE INDEX "hour_records_squad_id_date_idx" ON "hour_records"("squad_id", "date");

-- CreateIndex
CREATE INDEX "hour_records_role_type_date_idx" ON "hour_records"("role_type", "date");

-- CreateIndex
CREATE INDEX "hour_records_client_id_date_is_non_billable_idx" ON "hour_records"("client_id", "date", "is_non_billable");

-- CreateIndex
CREATE UNIQUE INDEX "nonbillable_categories_name_key" ON "nonbillable_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "nonbillable_source_mappings_source_identifier_value_key" ON "nonbillable_source_mappings"("source", "identifier_value");

-- CreateIndex
CREATE UNIQUE INDEX "jira_component_client_mappings_jira_instance_component_key__key" ON "jira_component_client_mappings"("jira_instance", "component_key", "effective_from");

-- CreateIndex
CREATE INDEX "sync_logs_source_started_at_idx" ON "sync_logs"("source", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_conflicts_external_ref_key" ON "sync_conflicts"("external_ref");

-- CreateIndex
CREATE INDEX "sync_conflicts_category_idx" ON "sync_conflicts"("category");

-- CreateIndex
CREATE INDEX "anomaly_flags_client_id_month_idx" ON "anomaly_flags"("client_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "anomaly_flags_client_id_month_flag_type_role_type_detector__key" ON "anomaly_flags"("client_id", "month", "flag_type", "role_type", "detector_version");

-- CreateIndex
CREATE INDEX "nonbillable_enhancement_suggestions_month_status_idx" ON "nonbillable_enhancement_suggestions"("month", "status");

-- AddForeignKey
ALTER TABLE "squads" ADD CONSTRAINT "squads_lead_person_id_fkey" FOREIGN KEY ("lead_person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_capacity_history" ADD CONSTRAINT "person_capacity_history_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements_of_work" ADD CONSTRAINT "statements_of_work_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements_of_work" ADD CONSTRAINT "statements_of_work_parent_sow_id_fkey" FOREIGN KEY ("parent_sow_id") REFERENCES "statements_of_work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "statements_of_work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaration_role_entries" ADD CONSTRAINT "declaration_role_entries_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "monthly_role_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_nonbillable_category_id_fkey" FOREIGN KEY ("nonbillable_category_id") REFERENCES "nonbillable_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_source_mappings" ADD CONSTRAINT "nonbillable_source_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "nonbillable_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_component_client_mappings" ADD CONSTRAINT "jira_component_client_mappings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_enhancement_suggestions" ADD CONSTRAINT "nonbillable_enhancement_suggestions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_enhancement_suggestions" ADD CONSTRAINT "nonbillable_enhancement_suggestions_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-crafted SQL (not expressible in prisma/schema.prisma).
-- Squashed from the original per-feature migrations. Tables created above must
-- already exist, so this section runs last. Order: extension → EXCLUDE
-- constraints → allocation-sum trigger → partial indexes.
-- ─────────────────────────────────────────────────────────────────────────────

-- btree_gist powers the gist EXCLUDE constraints below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- S2: DB-level overlap enforcement for temporal rows.
-- squad_id is part of the membership constraint: concurrent memberships in
-- DIFFERENT squads are legitimate (split allocations).
-- '[]' (closed) intervals match the application's inclusive effectiveTo
-- semantics (effectiveTo >= date; rows are end-dated at new_start - 1 day).
ALTER TABLE squad_memberships
  ADD CONSTRAINT no_overlapping_memberships
  EXCLUDE USING gist (
    person_id WITH =,
    squad_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );

ALTER TABLE person_roles
  ADD CONSTRAINT no_overlapping_roles
  EXCLUDE USING gist (
    person_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );

-- BR-2 (DB-level backstop): a Jira component maps to exactly one contract at
-- a time. The application end-dates the prior open mapping on create; this
-- constraint guarantees it against direct DB writes and older routes.
ALTER TABLE jira_component_client_mappings
  ADD CONSTRAINT no_overlapping_component_mappings
  EXCLUDE USING gist (
    jira_instance WITH =,
    component_key WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );

-- BR-11: the sum of allocation_pct across a person's overlapping squad
-- memberships must never exceed 1.0 at any point in time. A CHECK or EXCLUDE
-- constraint cannot express a cross-row aggregate, so this is a constraint
-- trigger.
CREATE OR REPLACE FUNCTION enforce_allocation_sum() RETURNS trigger AS $$
DECLARE
  max_total numeric;
BEGIN
  -- Serialize membership writes per person so two concurrent inserts cannot
  -- each pass the check and together exceed 1.0 (lock released at commit).
  PERFORM pg_advisory_xact_lock(42001, NEW.person_id);

  -- The running per-day sum only increases on a row's effective_from, so
  -- checking each start day inside the new row's range covers the maximum.
  SELECT max(total) INTO max_total
  FROM (
    SELECT sum(sm.allocation_pct) AS total
    FROM (
      SELECT NEW.effective_from AS day
      UNION
      SELECT effective_from FROM squad_memberships
      WHERE person_id = NEW.person_id
        AND effective_from > NEW.effective_from
        AND (NEW.effective_to IS NULL OR effective_from <= NEW.effective_to)
    ) b
    JOIN squad_memberships sm
      ON sm.person_id = NEW.person_id
     AND daterange(sm.effective_from, sm.effective_to, '[]') @> b.day
    GROUP BY b.day
  ) t;

  IF max_total > 1.0 THEN
    RAISE EXCEPTION 'allocation_sum_exceeded: person % would reach allocation % (max 1.0)',
      NEW.person_id, max_total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER allocation_sum_check
  AFTER INSERT OR UPDATE ON squad_memberships
  FOR EACH ROW EXECUTE FUNCTION enforce_allocation_sum();

-- PARTIAL INDEX: active anomaly flags for the alert inbox.
CREATE INDEX idx_anomaly_active
  ON anomaly_flags (client_id, month, severity) WHERE resolved_at IS NULL;

-- PARTIAL INDEX: supports the `archived_at IS NULL` predicate on every
-- analytics read of hour_records (soft-delete via Jira worklog reconciliation).
CREATE INDEX "hour_records_active_idx"
  ON "hour_records" ("archived_at")
  WHERE "archived_at" IS NULL;

