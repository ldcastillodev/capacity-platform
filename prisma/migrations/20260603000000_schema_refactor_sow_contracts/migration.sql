-- =============================================================================
-- Schema Refactor: SOW / Contract / Extension
-- Drops 20 tables, adds StatementOfWork + Contract + Extension.
-- RetainerContract (retainer_contracts) replaced by Contract (contracts).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SAFETY ASSERTIONS: verify dropped FK columns in hour_records are all NULL
-- (they were never written by application code, but confirm before dropping)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hour_records
    WHERE contract_extension_id IS NOT NULL
       OR change_order_id IS NOT NULL
       OR sme_engagement_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'hour_records has non-null dropped FK columns — abort migration';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PRE-MIGRATION DATA FIXES
-- ---------------------------------------------------------------------------

-- 1. Remove cascade_violation flags (enum value is being dropped)
DELETE FROM anomaly_flags WHERE flag_type = 'cascade_violation';

-- 2. Null out declaration→retainer_contract links (retainer_contracts table dropped;
--    new contracts table starts empty so existing IDs would violate the new FK)
UPDATE monthly_role_declarations SET contract_id = NULL WHERE contract_id IS NOT NULL;

-- 3. Null out declaration→contract_extension links (contract_extensions table dropped)
UPDATE monthly_role_declarations SET extension_id = NULL WHERE extension_id IS NOT NULL;

-- =============================================================================
-- GENERATED DDL (from prisma migrate diff, reviewed and approved)
-- =============================================================================

-- CreateEnum
CREATE TYPE "HourType" AS ENUM ('monthly', 'total');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('base', 'change_order');

-- AlterEnum
BEGIN;
CREATE TYPE "AnomalyFlagType_new" AS ENUM ('spike', 'underuse', 'pace_risk', 'underburn_risk', 'role_substitution', 'missing_data');
ALTER TABLE "anomaly_flags" ALTER COLUMN "flag_type" TYPE "AnomalyFlagType_new" USING ("flag_type"::text::"AnomalyFlagType_new");
ALTER TYPE "AnomalyFlagType" RENAME TO "AnomalyFlagType_old";
ALTER TYPE "AnomalyFlagType_new" RENAME TO "AnomalyFlagType";
DROP TYPE "AnomalyFlagType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "billing_rates" DROP CONSTRAINT "billing_rates_client_id_fkey";

-- DropForeignKey
ALTER TABLE "ceremony_attributions" DROP CONSTRAINT "ceremony_attributions_client_id_fkey";

-- DropForeignKey
ALTER TABLE "ceremony_attributions" DROP CONSTRAINT "ceremony_attributions_squad_id_fkey";

-- DropForeignKey
ALTER TABLE "change_order_history" DROP CONSTRAINT "change_order_history_change_order_id_fkey";

-- DropForeignKey
ALTER TABLE "change_order_line_item_history" DROP CONSTRAINT "change_order_line_item_history_line_item_id_fkey";

-- DropForeignKey
ALTER TABLE "change_order_line_items" DROP CONSTRAINT "change_order_line_items_change_order_id_fkey";

-- DropForeignKey
ALTER TABLE "change_orders" DROP CONSTRAINT "change_orders_client_id_fkey";

-- DropForeignKey
ALTER TABLE "change_orders" DROP CONSTRAINT "change_orders_squad_id_fkey";

-- DropForeignKey
ALTER TABLE "client_person_access" DROP CONSTRAINT "client_person_access_client_id_fkey";

-- DropForeignKey
ALTER TABLE "client_person_access" DROP CONSTRAINT "client_person_access_person_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_amendments" DROP CONSTRAINT "contract_amendments_contract_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_extension_history" DROP CONSTRAINT "contract_extension_history_extension_id_fkey";

-- DropForeignKey
ALTER TABLE "contract_extensions" DROP CONSTRAINT "contract_extensions_client_id_fkey";

-- DropForeignKey
ALTER TABLE "cost_rates" DROP CONSTRAINT "cost_rates_person_id_fkey";

-- DropForeignKey
ALTER TABLE "holiday_entries" DROP CONSTRAINT "holiday_entries_calendar_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_ceremony_allocations" DROP CONSTRAINT "monthly_ceremony_allocations_client_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_ceremony_allocations" DROP CONSTRAINT "monthly_ceremony_allocations_person_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_ceremony_allocations" DROP CONSTRAINT "monthly_ceremony_allocations_squad_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_role_declarations" DROP CONSTRAINT "monthly_role_declarations_contract_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_role_declarations" DROP CONSTRAINT "monthly_role_declarations_extension_id_fkey";

-- DropForeignKey
ALTER TABLE "person_calendar_assignments" DROP CONSTRAINT "person_calendar_assignments_calendar_id_fkey";

-- DropForeignKey
ALTER TABLE "person_calendar_assignments" DROP CONSTRAINT "person_calendar_assignments_person_id_fkey";

-- DropForeignKey
ALTER TABLE "retainer_contracts" DROP CONSTRAINT "retainer_contracts_client_id_fkey";

-- DropForeignKey
ALTER TABLE "retainer_contracts" DROP CONSTRAINT "retainer_contracts_squad_id_fkey";

-- DropForeignKey
ALTER TABLE "role_cascade_rules" DROP CONSTRAINT "role_cascade_rules_client_id_fkey";

-- DropForeignKey
ALTER TABLE "sme_engagement_history" DROP CONSTRAINT "sme_engagement_history_engagement_id_fkey";

-- DropForeignKey
ALTER TABLE "sme_engagements" DROP CONSTRAINT "sme_engagements_client_id_fkey";

-- DropForeignKey
ALTER TABLE "sme_engagements" DROP CONSTRAINT "sme_engagements_person_id_fkey";

-- DropForeignKey
ALTER TABLE "sme_engagements" DROP CONSTRAINT "sme_engagements_squad_id_fkey";

-- DropForeignKey
ALTER TABLE "te_billing_configs" DROP CONSTRAINT "te_billing_configs_client_id_fkey";

-- DropForeignKey
ALTER TABLE "te_billing_role_rates" DROP CONSTRAINT "te_billing_role_rates_te_billing_config_id_fkey";

-- DropIndex
DROP INDEX "monthly_role_declarations_extension_id_month_role_type_idx";

-- AlterTable
ALTER TABLE "hour_records" DROP COLUMN "change_order_id",
DROP COLUMN "contract_extension_id",
DROP COLUMN "sme_engagement_id",
ADD COLUMN     "contract_id" INTEGER;

-- AlterTable
ALTER TABLE "monthly_role_declarations" DROP COLUMN "extension_id";

-- DropTable
DROP TABLE "billing_rates";

-- DropTable
DROP TABLE "ceremony_attributions";

-- DropTable
DROP TABLE "change_order_history";

-- DropTable
DROP TABLE "change_order_line_item_history";

-- DropTable
DROP TABLE "change_order_line_items";

-- DropTable
DROP TABLE "change_orders";

-- DropTable
DROP TABLE "client_person_access";

-- DropTable
DROP TABLE "contract_amendments";

-- DropTable
DROP TABLE "contract_extension_history";

-- DropTable
DROP TABLE "contract_extensions";

-- DropTable
DROP TABLE "cost_rates";

-- DropTable
DROP TABLE "holiday_calendars";

-- DropTable
DROP TABLE "holiday_entries";

-- DropTable
DROP TABLE "monthly_ceremony_allocations";

-- DropTable
DROP TABLE "person_calendar_assignments";

-- DropTable
DROP TABLE "retainer_contracts";

-- DropTable
DROP TABLE "role_cascade_rules";

-- DropTable
DROP TABLE "sme_engagement_history";

-- DropTable
DROP TABLE "sme_engagements";

-- DropTable
DROP TABLE "te_billing_configs";

-- DropTable
DROP TABLE "te_billing_role_rates";

-- DropEnum
DROP TYPE "ChangeOrderStatus";

-- DropEnum
DROP TYPE "ExtensionStatus";

-- DropEnum
DROP TYPE "ExtensionType";

-- DropEnum
DROP TYPE "SMESource";

-- DropEnum
DROP TYPE "SMEStatus";

-- DropEnum
DROP TYPE "TEBillingType";

-- CreateTable
CREATE TABLE "statements_of_work" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "client_id" INTEGER NOT NULL,
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
CREATE TABLE "extensions" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "reason" TEXT,
    "target_month" DATE NOT NULL,

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "statements_of_work_parent_sow_id_key" ON "statements_of_work"("parent_sow_id");

-- CreateIndex
CREATE INDEX "statements_of_work_client_id_idx" ON "statements_of_work"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_parent_contract_id_key" ON "contracts"("parent_contract_id");

-- CreateIndex
CREATE INDEX "contracts_sow_id_status_idx" ON "contracts"("sow_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_contract_id_key" ON "extensions"("contract_id");

-- AddForeignKey
ALTER TABLE "statements_of_work" ADD CONSTRAINT "statements_of_work_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements_of_work" ADD CONSTRAINT "statements_of_work_parent_sow_id_fkey" FOREIGN KEY ("parent_sow_id") REFERENCES "statements_of_work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "statements_of_work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_role_declarations" ADD CONSTRAINT "monthly_role_declarations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
