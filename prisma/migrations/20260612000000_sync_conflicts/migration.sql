-- Per-worklog sync conflict records: one row per skipped worklog, deduped by
-- external_ref, upserted on each sync run and deleted once the worklog imports.

CREATE TYPE "SyncConflictCategory" AS ENUM (
  'missing_mapping',
  'missing_membership',
  'missing_role',
  'missing_declaration',
  'inactive_target'
);

CREATE TABLE "sync_conflicts" (
  "id"            SERIAL PRIMARY KEY,
  "source"        "SyncSource" NOT NULL,
  "external_ref"  TEXT NOT NULL,
  "category"      "SyncConflictCategory" NOT NULL,
  "author_email"  TEXT,
  "issue_key"     TEXT,
  "component_key" TEXT,
  "date"          DATE NOT NULL,
  "hours"         DECIMAL(6,2) NOT NULL,
  "detail"        TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at"  TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "sync_conflicts_external_ref_key" ON "sync_conflicts"("external_ref");
CREATE INDEX "sync_conflicts_category_idx" ON "sync_conflicts"("category");
