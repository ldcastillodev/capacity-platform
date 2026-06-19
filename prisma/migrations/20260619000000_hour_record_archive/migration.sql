-- Soft-delete support for HourRecord (Jira worklog reconciliation).
-- Deleted-in-Jira worklogs are archived, not hard-deleted, so history is auditable.
ALTER TABLE "hour_records"
  ADD COLUMN "archived_at" timestamp(3),
  ADD COLUMN "archive_reason" varchar(50);

-- Partial index supports the `archived_at IS NULL` predicate added to every
-- analytics read of hour_records.
CREATE INDEX "hour_records_active_idx"
  ON "hour_records" ("archived_at")
  WHERE "archived_at" IS NULL;
