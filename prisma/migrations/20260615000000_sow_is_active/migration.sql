-- Add soft-delete flag to statements_of_work (archive instead of hard delete)
ALTER TABLE "statements_of_work" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
