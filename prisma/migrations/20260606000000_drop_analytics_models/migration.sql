-- Migration: drop analytics snapshot models, Extension model, SimulationAction enum,
--            and add 'extension' value to ContractType enum.
--
-- ROLLBACK INSTRUCTIONS (run in order if you need to revert after commit):
--   1. CREATE TABLE "monthly_role_declaration_history" ... (restore from pg_dump taken before this migration)
--   2. CREATE TABLE "extensions" ...
--   3. CREATE TABLE "squad_capacity_configs" ...
--   4. CREATE TABLE "staffing_gap_snapshots" ...
--   5. CREATE TABLE "monthly_consumption_summaries" ...
--   6. CREATE TABLE "weekly_burn_snapshots" ...
--   7. CREATE TABLE "monthly_nonbillable_summaries" ...
--   8. CREATE TYPE "SimulationAction" AS ENUM ('available', 'hire_needed', 'redistribute');
--   NOTE: 'extension' cannot be removed from ContractType once committed (PG limitation).
--         If rollback needed, update application code to ignore the value instead.

-- Drop history ledger (FK to monthly_role_declarations)
DROP TABLE IF EXISTS "monthly_role_declaration_history";

-- Drop extension table (FK to contracts)
DROP TABLE IF EXISTS "extensions";

-- Drop capacity config (FK to squads)
DROP TABLE IF EXISTS "squad_capacity_configs";

-- Drop analytics snapshots
DROP TABLE IF EXISTS "staffing_gap_snapshots";
DROP TABLE IF EXISTS "monthly_consumption_summaries";
DROP TABLE IF EXISTS "weekly_burn_snapshots";
DROP TABLE IF EXISTS "monthly_nonbillable_summaries";

-- Drop unused enum (no column references it)
DROP TYPE IF EXISTS "SimulationAction";

-- Add extension value to ContractType enum
-- ALTER TYPE ... ADD VALUE cannot be rolled back after commit
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'extension';
