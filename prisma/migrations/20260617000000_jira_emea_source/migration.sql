/*
  Replaces the unused `manual` and `api` SyncSource values with `jira_emea`, and adds
  `jira_emea` to NbMappingSource. The `manual`/`api` values were only ever written by the
  now-removed POST /api/hours and POST /api/nonbillable-hours handlers; no row should carry
  them. The USING cast below FAILS if any row still has `manual` or `api` — run the pre-check
  first:

    SELECT DISTINCT source FROM hour_records
    UNION SELECT DISTINCT source FROM sync_logs
    UNION SELECT DISTINCT source FROM sync_conflicts;
*/

-- AlterEnum: SyncSource -> { jira_na, jira_emea }
BEGIN;
CREATE TYPE "SyncSource_new" AS ENUM ('jira_na', 'jira_emea');
ALTER TABLE "hour_records" ALTER COLUMN "source" TYPE "SyncSource_new" USING ("source"::text::"SyncSource_new");
ALTER TABLE "sync_logs" ALTER COLUMN "source" TYPE "SyncSource_new" USING ("source"::text::"SyncSource_new");
ALTER TABLE "sync_conflicts" ALTER COLUMN "source" TYPE "SyncSource_new" USING ("source"::text::"SyncSource_new");
ALTER TYPE "SyncSource" RENAME TO "SyncSource_old";
ALTER TYPE "SyncSource_new" RENAME TO "SyncSource";
DROP TYPE "SyncSource_old";
COMMIT;

-- AlterEnum: NbMappingSource -> { jira_na, jira_emea }
BEGIN;
CREATE TYPE "NbMappingSource_new" AS ENUM ('jira_na', 'jira_emea');
ALTER TABLE "nonbillable_source_mappings" ALTER COLUMN "source" TYPE "NbMappingSource_new" USING ("source"::text::"NbMappingSource_new");
ALTER TYPE "NbMappingSource" RENAME TO "NbMappingSource_old";
ALTER TYPE "NbMappingSource_new" RENAME TO "NbMappingSource";
DROP TYPE "NbMappingSource_old";
COMMIT;
