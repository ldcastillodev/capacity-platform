-- Wipe all existing declaration rows (fresh start on new schema)
TRUNCATE TABLE monthly_role_declarations RESTART IDENTITY CASCADE;

-- Drop per-row columns no longer needed on the parent
ALTER TABLE monthly_role_declarations
  DROP COLUMN IF EXISTS role_type,
  DROP COLUMN IF EXISTS declared_hours,
  DROP COLUMN IF EXISTS submitted_at,
  DROP COLUMN IF EXISTS submitted_by,
  DROP COLUMN IF EXISTS change_from_prior_hours,
  DROP COLUMN IF EXISTS significant_change_flag,
  DROP COLUMN IF EXISTS late_change_flag,
  DROP COLUMN IF EXISTS override_reason,
  DROP COLUMN IF EXISTS override_by;

-- Drop old composite index that included role_type
DROP INDEX IF EXISTS "monthly_role_declarations_contract_id_month_role_type_idx";

-- Rebuild DeclarationStatus enum without locked/derived (Postgres has no DROP VALUE)
ALTER TYPE "DeclarationStatus" RENAME TO "DeclarationStatus_old";
CREATE TYPE "DeclarationStatus" AS ENUM ('draft', 'confirmed');
ALTER TABLE monthly_role_declarations
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "DeclarationStatus" USING status::text::"DeclarationStatus",
  ALTER COLUMN status SET DEFAULT 'draft';
DROP TYPE "DeclarationStatus_old";

-- One declaration per contract+month
CREATE UNIQUE INDEX "monthly_role_declarations_contract_id_month_key"
  ON monthly_role_declarations (contract_id, month);

-- Child table: role entries per declaration
CREATE TABLE declaration_role_entries (
  id              SERIAL PRIMARY KEY,
  declaration_id  INTEGER NOT NULL REFERENCES monthly_role_declarations(id) ON DELETE CASCADE,
  role_type       "RoleType" NOT NULL,
  declared_hours  DECIMAL(8,2) NOT NULL
);

CREATE UNIQUE INDEX "declaration_role_entries_declaration_id_role_type_key"
  ON declaration_role_entries (declaration_id, role_type);

CREATE INDEX "declaration_role_entries_declaration_id_idx"
  ON declaration_role_entries (declaration_id);
