import prisma from "@/lib/prisma";
import { Prisma, type SyncConflictCategory, type SyncSource } from "@prisma/client";
import type { Db } from "../types";

/** SyncLog + SyncConflict queries (Jira integration audit trail). */

// ─── Sync Logs ───────────────────────────────────────────────────────────────

/**
 * List the 10 most recent sync logs (id/source/dates) — used to derive the
 * latest run per source. Empty → [].
 */
export function listRecentSyncLogs(db: Db = prisma) {
  return db.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      source: true,
      startedAt: true,
      completedAt: true,
      dateFrom: true,
      dateTo: true,
    },
  });
}

/**
 * List managed sync logs (with record counts), optionally by source. Newest
 * first, capped at 200. Empty → [].
 */
export function listManagedSyncLogs(filters: { source?: SyncSource }, db: Db = prisma) {
  return db.syncLog.findMany({
    where: filters.source ? { source: filters.source } : undefined,
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      source: true,
      startedAt: true,
      completedAt: true,
      dateFrom: true,
      dateTo: true,
      recordsFetched: true,
      recordsCreated: true,
      recordsSkipped: true,
      recordsConflicted: true,
    },
  });
}

/**
 * List sync logs (full rows), optionally by source, capped at `limit` (max 200).
 * Newest first. Empty → [].
 */
export function listSyncLogs(filters: { source?: SyncSource; limit?: number }, db: Db = prisma) {
  return db.syncLog.findMany({
    where: filters.source ? { source: filters.source } : undefined,
    orderBy: { startedAt: "desc" },
    take: Math.min(filters.limit ?? 50, 200),
  });
}

/** Create a sync-log row at the start of a sync run. */
export function createSyncLog(data: Prisma.SyncLogUncheckedCreateInput, db: Db = prisma) {
  return db.syncLog.create({ data });
}

/** Update a sync-log row (completion stats or error completion). */
export function updateSyncLog(
  id: number,
  data: Prisma.SyncLogUncheckedUpdateInput,
  db: Db = prisma
) {
  return db.syncLog.update({ where: { id }, data });
}

// ─── Sync Conflicts ──────────────────────────────────────────────────────────

/**
 * List sync conflicts, optionally by category. Most recently seen first,
 * capped at 200. Empty → [].
 */
export function listSyncConflicts(filters: { category?: SyncConflictCategory }, db: Db = prisma) {
  return db.syncConflict.findMany({
    where: filters.category ? { category: filters.category } : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true,
      source: true,
      externalRef: true,
      category: true,
      authorEmail: true,
      issueKey: true,
      componentKey: true,
      date: true,
      hours: true,
      detail: true,
      lastSeenAt: true,
    },
  });
}

/**
 * Upsert a conflict by externalRef so re-syncs refresh `lastSeenAt` instead of
 * duplicating.
 */
export function upsertSyncConflictByRef(
  externalRef: string,
  update: Prisma.SyncConflictUpdateInput,
  create: Prisma.SyncConflictUncheckedCreateInput,
  db: Db = prisma
) {
  return db.syncConflict.upsert({ where: { externalRef }, update, create });
}

/**
 * Upsert many conflicts by externalRef in a single transaction (one round trip)
 * instead of one await per record.
 */
export function upsertSyncConflictsBatch(
  records: {
    externalRef: string;
    update: Prisma.SyncConflictUpdateInput;
    create: Prisma.SyncConflictUncheckedCreateInput;
  }[]
) {
  return prisma.$transaction(
    records.map((r) =>
      prisma.syncConflict.upsert({
        where: { externalRef: r.externalRef },
        update: r.update,
        create: r.create,
      })
    )
  );
}

/** Delete conflicts whose worklogs imported this run. */
export function deleteSyncConflictsByRefs(externalRefs: string[], db: Db = prisma) {
  return db.syncConflict.deleteMany({ where: { externalRef: { in: externalRefs } } });
}
