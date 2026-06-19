import prisma from "@/lib/prisma";
import type { SyncSource } from "@prisma/client";
import type { Db } from "../types";

/**
 * Queries for Jira worklog reconciliation — detecting drift between persisted
 * HourRecord rows and the current state of their source worklogs in Jira.
 *
 * HourRecord is the SOLE source of truth for actual hours; these functions read
 * and write only HourRecord (never declaration tables). Reconciliation updates
 * `hours` in place and soft-deletes via `archivedAt` — attribution snapshots
 * (squad/role/contract/client) are never recomputed.
 */

/** A reconcilable HourRecord — has an externalRef linking it to a Jira worklog. */
export type ReconcilableHourRecord = {
  id: number;
  externalRef: string;
  issueKey: string | null;
  hours: number;
  clientId: number | null;
  date: Date;
};

/**
 * List active (non-archived) HourRecords for one source within a date window
 * that carry an externalRef (i.e. originated from a Jira worklog and can be
 * matched back to one). Rows with a null externalRef are excluded — they are not
 * reconcilable. Empty → [].
 */
export async function listReconcilableHourRecords(
  source: SyncSource,
  dateFrom: Date,
  dateTo: Date,
  db: Db = prisma
): Promise<ReconcilableHourRecord[]> {
  const rows = await db.hourRecord.findMany({
    where: {
      source,
      archivedAt: null,
      externalRef: { not: null },
      date: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true,
      externalRef: true,
      issueKey: true,
      hours: true,
      clientId: true,
      date: true,
    },
  });
  // externalRef is non-null here (filtered above); narrow the type and coerce the
  // Decimal hours to a plain number for comparison against Jira's seconds/3600.
  return rows.map((r) => ({
    id: r.id,
    externalRef: r.externalRef as string,
    issueKey: r.issueKey,
    hours: Number(r.hours),
    clientId: r.clientId,
    date: r.date,
  }));
}

/** Update only an HourRecord's hours (attribution snapshot left untouched). */
export function updateHourRecordHours(id: number, hours: number, db: Db = prisma) {
  return db.hourRecord.update({ where: { id }, data: { hours } });
}

/** Soft-delete an HourRecord: stamp archivedAt + reason; row is never hard-deleted. */
export function softDeleteHourRecord(id: number, reason: string, db: Db = prisma) {
  return db.hourRecord.update({
    where: { id },
    data: { archivedAt: new Date(), archiveReason: reason },
  });
}
