-- Track whether a sync run succeeded. completedAt + success distinguish
-- running (completedAt null) / success (true) / error (completedAt set, success false).
ALTER TABLE "sync_logs" DROP COLUMN IF EXISTS "error";
ALTER TABLE "sync_logs" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT false;
