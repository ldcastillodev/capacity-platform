-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('frontend_dev', 'backend_dev', 'fullstack_dev', 'devops', 'qa', 'ux_designer', 'product_manager', 'project_manager', 'tech_lead', 'solutions_architect', 'data_engineer', 'scrum_master', 'business_analyst', 'seo', 'content_author', 'client_services');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('dedicated', 'shared');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('emea', 'na');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GBP', 'EUR');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('draft', 'confirmed', 'locked', 'derived');

-- CreateEnum
CREATE TYPE "ExtensionType" AS ENUM ('te', 'co');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('pending_approval', 'approved', 'rejected', 'closed');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('pending_written', 'pending_docusign', 'approved', 'active', 'closed');

-- CreateEnum
CREATE TYPE "TEBillingType" AS ENUM ('same_rate', 'premium_flat', 'premium_pct', 'blended_rate', 'per_role');

-- CreateEnum
CREATE TYPE "SMESource" AS ENUM ('internal_other_squad', 'external_contractor');

-- CreateEnum
CREATE TYPE "SMEStatus" AS ENUM ('requested', 'confirmed', 'active', 'closed');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('tempo', 'jira_na', 'manual', 'api');

-- CreateEnum
CREATE TYPE "BudgetSource" AS ENUM ('retainer', 'te', 'change_order', 'sme');

-- CreateEnum
CREATE TYPE "NonBillableType" AS ENUM ('shared_ceremony', 'leave', 'internal_meeting', 'training', 'company');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('safe', 'watch', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AnomalyFlagType" AS ENUM ('spike', 'underuse', 'pace_risk', 'underburn_risk', 'role_substitution', 'missing_data', 'cascade_violation');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('declaration_adjustment', 'pto_capacity_warning', 'ceremony_overhead', 'nonbillable_trend');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'acknowledged', 'applied', 'dismissed');

-- CreateEnum
CREATE TYPE "SimulationAction" AS ENUM ('available', 'hire_needed', 'redistribute');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('full', 'delta');

-- CreateEnum
CREATE TYPE "NbMappingSource" AS ENUM ('tempo', 'jira_na');

-- CreateEnum
CREATE TYPE "NbIdentifierType" AS ENUM ('issue_key', 'account_key', 'component_key');

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
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'dedicated',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    "tempo_account_id" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
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
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
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
CREATE TABLE "client_person_access" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" INTEGER,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "client_person_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_capacity_configs" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "hard_buffer_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.1500,
    "soft_buffer_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.1000,

    CONSTRAINT "squad_capacity_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_cascade_rules" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "trigger_role" "RoleType" NOT NULL,
    "dependent_role" "RoleType" NOT NULL,
    "ratio" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "role_cascade_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendars" (
    "id" SERIAL NOT NULL,
    "region" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "holiday_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_entries" (
    "id" SERIAL NOT NULL,
    "calendar_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "holiday_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_calendar_assignments" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "calendar_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "person_calendar_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retainer_contracts" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "total_pool_hours" DECIMAL(8,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retainer_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_role_declarations" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER,
    "extension_id" INTEGER,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "declared_hours" DECIMAL(8,2) NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" INTEGER,
    "change_from_prior_hours" DECIMAL(8,2),
    "significant_change_flag" BOOLEAN NOT NULL DEFAULT false,
    "late_change_flag" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "override_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_role_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_rates" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "role_type" "RoleType",
    "rate_per_hour" DECIMAL(10,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "billing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_rates" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER,
    "role_type" "RoleType",
    "rate_per_hour" DECIMAL(10,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "cost_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "te_billing_configs" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "type" "TEBillingType" NOT NULL,
    "value" DECIMAL(10,4),
    "currency" "Currency",

    CONSTRAINT "te_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "te_billing_role_rates" (
    "id" SERIAL NOT NULL,
    "te_billing_config_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "rate_per_hour" DECIMAL(10,4) NOT NULL,
    "currency" "Currency" NOT NULL,

    CONSTRAINT "te_billing_role_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_extensions" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "type" "ExtensionType" NOT NULL DEFAULT 'te',
    "status" "ExtensionStatus" NOT NULL DEFAULT 'pending_approval',
    "requested_hours" DECIMAL(8,2) NOT NULL,
    "role_type" "RoleType",
    "rate_override" DECIMAL(10,4),
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "resolved_rate" DECIMAL(10,4),
    "resolved_currency" "Currency",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "date_range_start" DATE NOT NULL,
    "date_range_end" DATE NOT NULL,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'pending_written',
    "written_approval_ref" VARCHAR(500),
    "written_approval_at" TIMESTAMP(3),
    "docusign_envelope_id" VARCHAR(200),
    "docusign_signed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_order_line_items" (
    "id" SERIAL NOT NULL,
    "change_order_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "rate_override" DECIMAL(10,4),

    CONSTRAINT "change_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sme_engagements" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "role_description" VARCHAR(200) NOT NULL,
    "source" "SMESource" NOT NULL,
    "person_id" INTEGER,
    "contracted_hours" DECIMAL(8,2) NOT NULL,
    "cost_rate" DECIMAL(10,4) NOT NULL,
    "billing_rate" DECIMAL(10,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "approved_by" INTEGER,
    "status" "SMEStatus" NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sme_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_records" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "source" "SyncSource" NOT NULL,
    "budget_source" "BudgetSource" NOT NULL DEFAULT 'retainer',
    "contract_extension_id" INTEGER,
    "change_order_id" INTEGER,
    "sme_engagement_id" INTEGER,
    "external_ref" VARCHAR(300),
    "description" TEXT,
    "issue_key" VARCHAR(50),
    "issue_summary" TEXT,
    "billing_rate_snapshot" DECIMAL(10,4),
    "cost_rate_snapshot" DECIMAL(10,4),
    "currency_snapshot" "Currency",
    "billed_amount_snapshot" DECIMAL(12,4),
    "cost_amount_snapshot" DECIMAL(12,4),
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
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "nonbillable_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonbillable_entries" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "notes" TEXT,
    "external_ref" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nonbillable_entries_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "tempo_account_client_mappings" (
    "id" SERIAL NOT NULL,
    "account_key" VARCHAR(200) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "tempo_account_client_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_component_client_mappings" (
    "id" SERIAL NOT NULL,
    "jira_instance" VARCHAR(10) NOT NULL DEFAULT 'na',
    "component_key" VARCHAR(200) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "jira_component_client_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "source" "SyncSource" NOT NULL,
    "sync_type" "SyncType" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "date_from" TIMESTAMP(3),
    "date_to" TIMESTAMP(3),
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "records_conflicted" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "unmapped_refs" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_gap_snapshots" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "month" DATE NOT NULL,
    "total_available_hours" DECIMAL(8,2) NOT NULL,
    "hard_buffer_hours" DECIMAL(8,2) NOT NULL,
    "soft_buffer_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "committed_hours" DECIMAL(8,2) NOT NULL,
    "actual_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "unplanned_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "actual_nb_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "net_gap_hours" DECIMAL(8,2) NOT NULL,
    "commitment_ratio" DECIMAL(6,4) NOT NULL,
    "is_understaffed" BOOLEAN NOT NULL DEFAULT false,
    "is_overstaffed" BOOLEAN NOT NULL DEFAULT false,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capacity_hours_at_time" DECIMAL(8,2),
    "hard_buffer_pct_at_time" DECIMAL(5,4),
    "soft_buffer_pct_at_time" DECIMAL(5,4),

    CONSTRAINT "staffing_gap_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_consumption_summaries" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "role_type" "RoleType",
    "declared_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "consumed_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "retainer_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "te_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "co_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sme_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "remaining_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "utilization_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "billed_revenue" DECIMAL(12,4),
    "direct_cost" DECIMAL(12,4),
    "attributed_ceremony_cost" DECIMAL(12,4),
    "gross_margin" DECIMAL(12,4),
    "gross_margin_pct" DECIMAL(6,4),
    "last_refreshed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_consumption_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_burn_snapshots" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "week_start" DATE NOT NULL,
    "role_type" "RoleType",
    "cumulative_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "expected_cumulative" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "burn_rate_ratio" DECIMAL(6,4) NOT NULL DEFAULT 1,
    "projected_eom_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "pool_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "alert_level" "AlertLevel" NOT NULL DEFAULT 'safe',
    "projected_exhaustion_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_burn_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceremony_attributions" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "squad_total_ceremony_hours" DECIMAL(8,2) NOT NULL,
    "client_actual_hours" DECIMAL(8,2) NOT NULL,
    "squad_total_actual_hours" DECIMAL(8,2) NOT NULL,
    "attribution_fraction" DECIMAL(6,4) NOT NULL,
    "attributed_hours" DECIMAL(8,2) NOT NULL,
    "cost_impact" DECIMAL(12,4),
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceremony_attributions_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "monthly_nonbillable_summaries" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "category_type" "NonBillableType",
    "total_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "capacity_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "nonbillable_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "billable_hours_lost" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "prior_month_hours" DECIMAL(8,2),
    "month_over_month_delta" DECIMAL(8,2),
    "last_refreshed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_nonbillable_summaries_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "monthly_ceremony_allocations" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "squad_id" INTEGER,
    "month" DATE NOT NULL,
    "allocated_hours" DECIMAL(8,2) NOT NULL,
    "last_refreshed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_ceremony_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_simulations" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "name" VARCHAR(200) NOT NULL DEFAULT '',
    "proposed_client_name" VARCHAR(200) NOT NULL,
    "proposed_start_month" DATE NOT NULL,
    "proposed_pool_hours" DECIMAL(8,2) NOT NULL,
    "requested_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "simulation_result" TEXT,
    "feasible" BOOLEAN,
    "bottleneck_role" "RoleType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_simulation_line_items" (
    "id" SERIAL NOT NULL,
    "simulation_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "requested_hours" DECIMAL(8,2) NOT NULL,
    "available_hours" DECIMAL(8,2) NOT NULL,
    "gap_hours" DECIMAL(8,2) NOT NULL,
    "action" "SimulationAction" NOT NULL,
    "ftes_to_hire" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "estimated_margin_pct" DECIMAL(6,4),

    CONSTRAINT "client_simulation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_role_declaration_history" (
    "id" SERIAL NOT NULL,
    "declaration_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "prev_declared_hours" DECIMAL(8,2),
    "new_declared_hours" DECIMAL(8,2),
    "prev_status" "DeclarationStatus",
    "new_status" "DeclarationStatus",
    "reason" TEXT,

    CONSTRAINT "monthly_role_declaration_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "prev_pool_hours" DECIMAL(8,2) NOT NULL,
    "new_pool_hours" DECIMAL(8,2) NOT NULL,
    "reason" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_extension_history" (
    "id" SERIAL NOT NULL,
    "extension_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "prev_status" "ExtensionStatus",
    "new_status" "ExtensionStatus",
    "prev_requested_hours" DECIMAL(8,2),
    "new_requested_hours" DECIMAL(8,2),
    "prev_rate_override" DECIMAL(10,4),
    "new_rate_override" DECIMAL(10,4),

    CONSTRAINT "contract_extension_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_order_history" (
    "id" SERIAL NOT NULL,
    "change_order_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "prev_status" "ChangeOrderStatus",
    "new_status" "ChangeOrderStatus",
    "prev_notes" TEXT,

    CONSTRAINT "change_order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_order_line_item_history" (
    "id" SERIAL NOT NULL,
    "line_item_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "prev_hours" DECIMAL(8,2),
    "new_hours" DECIMAL(8,2),
    "prev_rate_override" DECIMAL(10,4),
    "new_rate_override" DECIMAL(10,4),

    CONSTRAINT "change_order_line_item_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sme_engagement_history" (
    "id" SERIAL NOT NULL,
    "engagement_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" INTEGER,
    "prev_status" "SMEStatus",
    "new_status" "SMEStatus",
    "prev_billing_rate" DECIMAL(10,4),
    "new_billing_rate" DECIMAL(10,4),
    "prev_cost_rate" DECIMAL(10,4),
    "new_cost_rate" DECIMAL(10,4),

    CONSTRAINT "sme_engagement_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "squads_name_key" ON "squads"("name");

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "persons_tempo_account_id_key" ON "persons"("tempo_account_id");

-- CreateIndex
CREATE INDEX "squad_memberships_squad_id_idx" ON "squad_memberships"("squad_id");

-- CreateIndex
CREATE UNIQUE INDEX "squad_memberships_person_id_squad_id_effective_from_key" ON "squad_memberships"("person_id", "squad_id", "effective_from");

-- CreateIndex
CREATE INDEX "person_roles_person_id_role_type_idx" ON "person_roles"("person_id", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "squad_capacity_configs_squad_id_role_type_key" ON "squad_capacity_configs"("squad_id", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "role_cascade_rules_client_id_trigger_role_dependent_role_key" ON "role_cascade_rules"("client_id", "trigger_role", "dependent_role");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendars_region_name_key" ON "holiday_calendars"("region", "name");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_entries_calendar_id_date_key" ON "holiday_entries"("calendar_id", "date");

-- CreateIndex
CREATE INDEX "person_calendar_assignments_person_id_idx" ON "person_calendar_assignments"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_calendar_assignments_person_id_effective_from_key" ON "person_calendar_assignments"("person_id", "effective_from");

-- CreateIndex
CREATE INDEX "retainer_contracts_client_id_status_idx" ON "retainer_contracts"("client_id", "status");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_client_id_month_idx" ON "monthly_role_declarations"("client_id", "month");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_squad_id_month_idx" ON "monthly_role_declarations"("squad_id", "month");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_contract_id_month_role_type_idx" ON "monthly_role_declarations"("contract_id", "month", "role_type");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_extension_id_month_role_type_idx" ON "monthly_role_declarations"("extension_id", "month", "role_type");

-- CreateIndex
CREATE INDEX "monthly_role_declarations_client_id_month_status_idx" ON "monthly_role_declarations"("client_id", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_rates_client_id_role_type_effective_from_key" ON "billing_rates"("client_id", "role_type", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "cost_rates_person_id_role_type_effective_from_key" ON "cost_rates"("person_id", "role_type", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "te_billing_configs_client_id_key" ON "te_billing_configs"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "te_billing_role_rates_te_billing_config_id_role_type_key" ON "te_billing_role_rates"("te_billing_config_id", "role_type");

-- CreateIndex
CREATE INDEX "contract_extensions_client_id_month_idx" ON "contract_extensions"("client_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "change_order_line_items_change_order_id_role_type_key" ON "change_order_line_items"("change_order_id", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "hour_records_external_ref_key" ON "hour_records"("external_ref");

-- CreateIndex
CREATE INDEX "hour_records_client_id_date_idx" ON "hour_records"("client_id", "date");

-- CreateIndex
CREATE INDEX "hour_records_person_id_date_idx" ON "hour_records"("person_id", "date");

-- CreateIndex
CREATE INDEX "hour_records_role_type_date_idx" ON "hour_records"("role_type", "date");

-- CreateIndex
CREATE INDEX "hour_records_client_id_date_budget_source_idx" ON "hour_records"("client_id", "date", "budget_source");

-- CreateIndex
CREATE UNIQUE INDEX "nonbillable_categories_name_key" ON "nonbillable_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "nonbillable_entries_external_ref_key" ON "nonbillable_entries"("external_ref");

-- CreateIndex
CREATE INDEX "nonbillable_entries_person_id_date_idx" ON "nonbillable_entries"("person_id", "date");

-- CreateIndex
CREATE INDEX "nonbillable_entries_squad_id_date_idx" ON "nonbillable_entries"("squad_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "nonbillable_source_mappings_source_identifier_value_key" ON "nonbillable_source_mappings"("source", "identifier_value");

-- CreateIndex
CREATE UNIQUE INDEX "tempo_account_client_mappings_account_key_effective_from_key" ON "tempo_account_client_mappings"("account_key", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "jira_component_client_mappings_jira_instance_component_key__key" ON "jira_component_client_mappings"("jira_instance", "component_key", "effective_from");

-- CreateIndex
CREATE INDEX "sync_logs_source_started_at_idx" ON "sync_logs"("source", "started_at");

-- CreateIndex
CREATE INDEX "staffing_gap_snapshots_month_idx" ON "staffing_gap_snapshots"("month");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_gap_snapshots_squad_id_role_type_month_key" ON "staffing_gap_snapshots"("squad_id", "role_type", "month");

-- CreateIndex
CREATE INDEX "monthly_consumption_summaries_client_id_month_idx" ON "monthly_consumption_summaries"("client_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_consumption_summaries_client_id_month_role_type_key" ON "monthly_consumption_summaries"("client_id", "month", "role_type");

-- CreateIndex
CREATE INDEX "weekly_burn_snapshots_client_id_week_start_alert_level_idx" ON "weekly_burn_snapshots"("client_id", "week_start", "alert_level");

-- CreateIndex
CREATE INDEX "weekly_burn_snapshots_week_start_alert_level_idx" ON "weekly_burn_snapshots"("week_start", "alert_level");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_burn_snapshots_client_id_week_start_role_type_key" ON "weekly_burn_snapshots"("client_id", "week_start", "role_type");

-- CreateIndex
CREATE UNIQUE INDEX "ceremony_attributions_squad_id_client_id_month_key" ON "ceremony_attributions"("squad_id", "client_id", "month");

-- CreateIndex
CREATE INDEX "anomaly_flags_client_id_month_idx" ON "anomaly_flags"("client_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "anomaly_flags_client_id_month_flag_type_role_type_detector__key" ON "anomaly_flags"("client_id", "month", "flag_type", "role_type", "detector_version");

-- CreateIndex
CREATE INDEX "monthly_nonbillable_summaries_squad_id_month_idx" ON "monthly_nonbillable_summaries"("squad_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_nonbillable_summaries_person_id_month_category_type_key" ON "monthly_nonbillable_summaries"("person_id", "month", "category_type");

-- CreateIndex
CREATE INDEX "nonbillable_enhancement_suggestions_month_status_idx" ON "nonbillable_enhancement_suggestions"("month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_ceremony_allocations_person_id_client_id_month_key" ON "monthly_ceremony_allocations"("person_id", "client_id", "month");

-- CreateIndex
CREATE INDEX "client_simulations_client_id_created_at_idx" ON "client_simulations"("client_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_simulation_line_items_simulation_id_role_type_key" ON "client_simulation_line_items"("simulation_id", "role_type");

-- CreateIndex
CREATE INDEX "monthly_role_declaration_history_declaration_id_changed_at_idx" ON "monthly_role_declaration_history"("declaration_id", "changed_at");

-- CreateIndex
CREATE INDEX "contract_amendments_contract_id_effective_from_idx" ON "contract_amendments"("contract_id", "effective_from");

-- CreateIndex
CREATE INDEX "contract_extension_history_extension_id_changed_at_idx" ON "contract_extension_history"("extension_id", "changed_at");

-- CreateIndex
CREATE INDEX "change_order_history_change_order_id_changed_at_idx" ON "change_order_history"("change_order_id", "changed_at");

-- CreateIndex
CREATE INDEX "change_order_line_item_history_line_item_id_changed_at_idx" ON "change_order_line_item_history"("line_item_id", "changed_at");

-- CreateIndex
CREATE INDEX "sme_engagement_history_engagement_id_changed_at_idx" ON "sme_engagement_history"("engagement_id", "changed_at");

-- AddForeignKey
ALTER TABLE "squads" ADD CONSTRAINT "squads_lead_person_id_fkey" FOREIGN KEY ("lead_person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_person_access" ADD CONSTRAINT "client_person_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_person_access" ADD CONSTRAINT "client_person_access_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_capacity_configs" ADD CONSTRAINT "squad_capacity_configs_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_cascade_rules" ADD CONSTRAINT "role_cascade_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_entries" ADD CONSTRAINT "holiday_entries_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "holiday_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_calendar_assignments" ADD CONSTRAINT "person_calendar_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_calendar_assignments" ADD CONSTRAINT "person_calendar_assignments_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "holiday_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retainer_contracts" ADD CONSTRAINT "retainer_contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retainer_contracts" ADD CONSTRAINT "retainer_contracts_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "retainer_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "contract_extensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_rates" ADD CONSTRAINT "cost_rates_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "te_billing_configs" ADD CONSTRAINT "te_billing_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "te_billing_role_rates" ADD CONSTRAINT "te_billing_role_rates_te_billing_config_id_fkey" FOREIGN KEY ("te_billing_config_id") REFERENCES "te_billing_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extensions" ADD CONSTRAINT "contract_extensions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_order_line_items" ADD CONSTRAINT "change_order_line_items_change_order_id_fkey" FOREIGN KEY ("change_order_id") REFERENCES "change_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sme_engagements" ADD CONSTRAINT "sme_engagements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sme_engagements" ADD CONSTRAINT "sme_engagements_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sme_engagements" ADD CONSTRAINT "sme_engagements_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_entries" ADD CONSTRAINT "nonbillable_entries_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_entries" ADD CONSTRAINT "nonbillable_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "nonbillable_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_source_mappings" ADD CONSTRAINT "nonbillable_source_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "nonbillable_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tempo_account_client_mappings" ADD CONSTRAINT "tempo_account_client_mappings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_component_client_mappings" ADD CONSTRAINT "jira_component_client_mappings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_gap_snapshots" ADD CONSTRAINT "staffing_gap_snapshots_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_consumption_summaries" ADD CONSTRAINT "monthly_consumption_summaries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_burn_snapshots" ADD CONSTRAINT "weekly_burn_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceremony_attributions" ADD CONSTRAINT "ceremony_attributions_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceremony_attributions" ADD CONSTRAINT "ceremony_attributions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_nonbillable_summaries" ADD CONSTRAINT "monthly_nonbillable_summaries_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_nonbillable_summaries" ADD CONSTRAINT "monthly_nonbillable_summaries_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_enhancement_suggestions" ADD CONSTRAINT "nonbillable_enhancement_suggestions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonbillable_enhancement_suggestions" ADD CONSTRAINT "nonbillable_enhancement_suggestions_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_ceremony_allocations" ADD CONSTRAINT "monthly_ceremony_allocations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_ceremony_allocations" ADD CONSTRAINT "monthly_ceremony_allocations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_ceremony_allocations" ADD CONSTRAINT "monthly_ceremony_allocations_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_simulations" ADD CONSTRAINT "client_simulations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_simulations" ADD CONSTRAINT "client_simulations_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_simulation_line_items" ADD CONSTRAINT "client_simulation_line_items_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "client_simulations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declaration_history" ADD CONSTRAINT "monthly_role_declaration_history_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "monthly_role_declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "retainer_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extension_history" ADD CONSTRAINT "contract_extension_history_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "contract_extensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_order_history" ADD CONSTRAINT "change_order_history_change_order_id_fkey" FOREIGN KEY ("change_order_id") REFERENCES "change_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_order_line_item_history" ADD CONSTRAINT "change_order_line_item_history_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "change_order_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sme_engagement_history" ADD CONSTRAINT "sme_engagement_history_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "sme_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-crafted constraints (not expressible in Prisma schema) ──────────────

-- CHECK: HourRecord budget polymorphism
ALTER TABLE hour_records ADD CONSTRAINT chk_hour_budget_source CHECK (
  (budget_source = 'retainer'     AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
  (budget_source = 'te'           AND contract_extension_id IS NOT NULL AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
  (budget_source = 'change_order' AND contract_extension_id IS NULL     AND change_order_id IS NOT NULL AND sme_engagement_id IS NULL) OR
  (budget_source = 'sme'          AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NOT NULL)
);

-- CHECK: MonthlyRoleDeclaration source exclusivity
ALTER TABLE monthly_role_declarations ADD CONSTRAINT chk_declaration_source CHECK (
  (contract_id IS NOT NULL AND extension_id IS NULL)
  OR (contract_id IS NULL AND extension_id IS NOT NULL)
);

-- CHECK: CostRate must have at least one identifying dimension
ALTER TABLE cost_rates ADD CONSTRAINT chk_rate_identity
  CHECK (person_id IS NOT NULL OR role_type IS NOT NULL);

-- CHECK: SMEEngagement source integrity
ALTER TABLE sme_engagements ADD CONSTRAINT chk_sme_source_data CHECK (
  (source = 'internal_other_squad' AND person_id IS NOT NULL)
  OR (source = 'external_contractor')
);

-- PARTIAL INDEX: Active client-person access (one active grant per pair)
CREATE UNIQUE INDEX uq_active_client_person_access
  ON client_person_access (client_id, person_id) WHERE revoked_at IS NULL;

-- PARTIAL INDEX: One active primary role per person
CREATE UNIQUE INDEX uq_primary_role_per_person
  ON person_roles (person_id) WHERE is_primary = true AND effective_to IS NULL;

-- PARTIAL INDEX: Active anomaly flags for alert inbox
CREATE INDEX idx_anomaly_active
  ON anomaly_flags (client_id, month, severity) WHERE resolved_at IS NULL;
