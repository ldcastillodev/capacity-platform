-- Step 17: Enum tightening for SyncLog.syncType and NonBillableSourceMapping fields

CREATE TYPE "SyncType" AS ENUM ('full', 'delta');
ALTER TABLE sync_logs
  ALTER COLUMN sync_type TYPE "SyncType" USING sync_type::"SyncType";

CREATE TYPE "NbMappingSource" AS ENUM ('tempo', 'jira_na');
ALTER TABLE nonbillable_source_mappings
  ALTER COLUMN source TYPE "NbMappingSource" USING source::"NbMappingSource";

CREATE TYPE "NbIdentifierType" AS ENUM ('issue_key', 'account_key', 'component_key');
ALTER TABLE nonbillable_source_mappings
  ALTER COLUMN identifier_type TYPE "NbIdentifierType" USING identifier_type::"NbIdentifierType";
