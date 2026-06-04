-- Drop index referencing budget_source before dropping the column
DROP INDEX IF EXISTS "hour_records_client_id_date_budget_source_idx";

-- Remove deleted columns from hour_records
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "budget_source";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "description";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "issue_summary";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "billing_rate_snapshot";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "cost_rate_snapshot";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "currency_snapshot";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "billed_amount_snapshot";
ALTER TABLE "hour_records" DROP COLUMN IF EXISTS "cost_amount_snapshot";

-- Make client_id nullable (non-billable records may not belong to a client)
ALTER TABLE "hour_records" ALTER COLUMN "client_id" DROP NOT NULL;

-- Make role_type nullable (non-billable records may not have a meaningful role)
ALTER TABLE "hour_records" ALTER COLUMN "role_type" DROP NOT NULL;

-- Add new columns to hour_records
ALTER TABLE "hour_records" ADD COLUMN "is_non_billable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hour_records" ADD COLUMN "nonbillable_category_id" INTEGER;

-- Add FK: hour_records.nonbillable_category_id → nonbillable_categories.id
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_nonbillable_category_id_fkey"
  FOREIGN KEY ("nonbillable_category_id") REFERENCES "nonbillable_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add new index replacing the budget_source one
CREATE INDEX "hour_records_client_id_date_is_non_billable_idx"
  ON "hour_records"("client_id", "date", "is_non_billable");

-- Remove deleted columns from sync_logs
ALTER TABLE "sync_logs" DROP COLUMN IF EXISTS "sync_type";
ALTER TABLE "sync_logs" DROP COLUMN IF EXISTS "error_message";
ALTER TABLE "sync_logs" DROP COLUMN IF EXISTS "unmapped_refs";

-- Drop the nonbillable_entries table (data dropped; sync will repopulate as HourRecord)
DROP TABLE IF EXISTS "nonbillable_entries";

-- Drop orphaned enum types
DROP TYPE IF EXISTS "BudgetSource";
DROP TYPE IF EXISTS "SyncType";
