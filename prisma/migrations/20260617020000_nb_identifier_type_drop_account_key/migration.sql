-- Drop unused `account_key` value from NbIdentifierType.
-- Postgres cannot remove an enum value in place, so recreate the type.
-- The USING cast fails if any row still references account_key (intentional guard).
ALTER TYPE "NbIdentifierType" RENAME TO "NbIdentifierType_old";
CREATE TYPE "NbIdentifierType" AS ENUM ('issue_key', 'component_key');
ALTER TABLE "nonbillable_source_mappings"
  ALTER COLUMN "identifier_type" TYPE "NbIdentifierType"
  USING ("identifier_type"::text::"NbIdentifierType");
DROP TYPE "NbIdentifierType_old";
