import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Db } from "../types";

/**
 * HourRecord is the SOLE source of truth for ACTUAL logged hours. Every method
 * in this file reads or writes actuals; none touch MonthlyRoleDeclaration /
 * DeclarationRoleEntry (those are PLANNED hours — see declarationService).
 */

/** A half-open or closed date window. `lte` is inclusive, `lt` is exclusive. */
export type DateWindow = { gte: Date; lte?: Date; lt?: Date };

function dateFilter(w: DateWindow): Prisma.DateTimeFilter {
  return { gte: w.gte, ...(w.lte ? { lte: w.lte } : {}), ...(w.lt ? { lt: w.lt } : {}) };
}

/** An hour record joined to its non-billable category. */
export type NonBillableHourEntry = Prisma.HourRecordGetPayload<{
  include: { nonBillableCategory: true };
}>;

/**
 * List billable/non-billable hour records, optionally filtered by client,
 * person and date range. Newest first, capped at 500. Empty → [].
 */
export function listHourRecords(
  filters: { clientId?: number; personId?: number; dateFrom?: Date; dateTo?: Date },
  db: Db = prisma
) {
  const { clientId, personId, dateFrom, dateTo } = filters;
  return db.hourRecord.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(personId ? { personId } : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    },
    orderBy: { date: "desc" },
    take: 500,
  });
}

/** Create a single hour record (manual billable or non-billable entry). */
export function createHourRecord(data: Prisma.HourRecordUncheckedCreateInput, db: Db = prisma) {
  return db.hourRecord.create({ data });
}

/**
 * List non-billable hour records (with category), optionally filtered by person
 * and date range. Newest first, capped at 500. Empty → [].
 */
export function listNonBillableHourRecords(
  filters: { personId?: number; dateFrom?: Date; dateTo?: Date },
  db: Db = prisma
): Promise<NonBillableHourEntry[]> {
  const { personId, dateFrom, dateTo } = filters;
  return db.hourRecord.findMany({
    where: {
      isNonBillable: true,
      ...(personId ? { personId } : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    },
    include: { nonBillableCategory: true },
    orderBy: { date: "desc" },
    take: 500,
  });
}

/**
 * List a person's non-billable entries (with category) for a month, oldest
 * first. Empty → [].
 */
export function listNonBillableEntriesForPersonMonth(
  personId: number,
  monthStart: Date,
  monthEnd: Date,
  db: Db = prisma
): Promise<NonBillableHourEntry[]> {
  return db.hourRecord.findMany({
    where: { personId, isNonBillable: true, date: { gte: monthStart, lte: monthEnd } },
    include: { nonBillableCategory: true },
    orderBy: { date: "asc" },
  });
}

/**
 * List non-billable hours (roleType + hours only) for a month, optionally
 * restricted to people with an effective membership in a squad. Empty → [].
 */
export function listNonBillableHoursForRoleBreakdown(
  args: { monthStart: Date; monthEnd: Date; squadId?: number },
  db: Db = prisma
) {
  const { monthStart, monthEnd, squadId } = args;
  return db.hourRecord.findMany({
    where: {
      isNonBillable: true,
      ...(squadId
        ? {
            person: {
              squadMemberships: {
                some: {
                  squadId,
                  effectiveFrom: { lte: monthEnd },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
                },
              },
            },
          }
        : {}),
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { roleType: true, hours: true },
  });
}

/**
 * List a contract's billable hours (date + hours only) within a month, for
 * client-side weekly bucketing. Empty → [].
 */
export function listBillableHoursForContractMonth(
  contractId: number,
  monthStart: Date,
  monthEnd: Date,
  db: Db = prisma
) {
  return db.hourRecord.findMany({
    where: { contractId, isNonBillable: false, date: { gte: monthStart, lte: monthEnd } },
    select: { date: true, hours: true },
  });
}

/** Sum a contract's billable (actual) hours within a date window. */
export function sumBillableHoursByContract(
  contractId: number,
  window: DateWindow,
  db: Db = prisma
) {
  return db.hourRecord.aggregate({
    where: { contractId, isNonBillable: false, date: dateFilter(window) },
    _sum: { hours: true },
  });
}

/**
 * Sum billable (actual) hours per (contractId, roleType) for the given
 * contracts within a month. Empty → [].
 */
export function sumConsumedHoursByContractRole(
  contractIds: number[],
  monthStart: Date,
  monthEnd: Date,
  db: Db = prisma
) {
  return db.hourRecord.groupBy({
    by: ["contractId", "roleType"],
    where: {
      contractId: { in: contractIds },
      isNonBillable: false,
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { hours: true },
  });
}

/**
 * Sum lifetime billable (actual) hours per contract (no date bound). Used by
 * the Jira sync to compute remaining pool. Empty → [].
 */
export function sumLifetimeBillableHoursByContract(db: Db = prisma) {
  return db.hourRecord.groupBy({
    by: ["contractId"],
    where: { contractId: { not: null } },
    _sum: { hours: true },
  });
}

/** Sum non-billable (actual) hours per contract within a month. Empty → []. */
export function sumNonBillableHoursByContract(monthStart: Date, monthEnd: Date, db: Db = prisma) {
  return db.hourRecord.groupBy({
    by: ["contractId"],
    where: {
      isNonBillable: true,
      contractId: { not: null },
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { hours: true },
  });
}

/** Sum non-billable (actual) hours per client within a month. Empty → []. */
export function sumNonBillableHoursByClient(monthStart: Date, monthEnd: Date, db: Db = prisma) {
  return db.hourRecord.groupBy({
    by: ["clientId"],
    where: {
      isNonBillable: true,
      clientId: { not: null },
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { hours: true },
  });
}

/**
 * Sum non-billable (actual) hours per (person, squad, category) within a month,
 * optionally restricted to one squad. Empty → [].
 */
export function sumNonBillableHoursByPersonSquadCategory(
  args: { monthStart: Date; monthEnd: Date; squadId?: number },
  db: Db = prisma
) {
  const { monthStart, monthEnd, squadId } = args;
  return db.hourRecord.groupBy({
    by: ["personId", "squadId", "nonBillableCategoryId"],
    where: {
      isNonBillable: true,
      date: { gte: monthStart, lte: monthEnd },
      ...(squadId ? { squadId } : {}),
    },
    _sum: { hours: true },
  });
}

/**
 * Sum non-billable (actual) hours per (person, squad) within a window,
 * optionally restricted to one squad. Used for month-over-month deltas.
 * Empty → [].
 */
export function sumNonBillableHoursByPersonSquad(
  args: { from: Date; to: Date; squadId?: number },
  db: Db = prisma
) {
  const { from, to, squadId } = args;
  return db.hourRecord.groupBy({
    by: ["personId", "squadId"],
    where: { isNonBillable: true, date: { gte: from, lte: to }, ...(squadId ? { squadId } : {}) },
    _sum: { hours: true },
  });
}

/**
 * Sum billable (actual) hours per person within a month for the given people
 * (non-billable% denominator). Empty → [].
 */
export function sumBillableHoursByPerson(
  personIds: number[],
  monthStart: Date,
  monthEnd: Date,
  db: Db = prisma
) {
  return db.hourRecord.groupBy({
    by: ["personId"],
    where: {
      isNonBillable: false,
      date: { gte: monthStart, lte: monthEnd },
      personId: { in: personIds },
    },
    _sum: { hours: true },
  });
}

/** Find a client's most recent hour record date, or null. */
export function findLatestHourRecordDateForClient(clientId: number, db: Db = prisma) {
  return db.hourRecord.findFirst({
    where: { clientId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
}

/** Count hours attributed to a contract within an effective window. */
export function countHoursByContractWindow(
  contractId: number,
  from: Date,
  to: Date | null,
  db: Db = prisma
): Promise<number> {
  return db.hourRecord.count({
    where: { contractId, date: { gte: from, ...(to ? { lte: to } : {}) } },
  });
}

/** Count hours attributed to a (person, role) within an effective window. */
export function countHoursByPersonRoleWindow(
  personId: number,
  roleType: Prisma.HourRecordWhereInput["roleType"],
  from: Date,
  to: Date | null,
  db: Db = prisma
): Promise<number> {
  return db.hourRecord.count({
    where: { personId, roleType, date: { gte: from, ...(to ? { lte: to } : {}) } },
  });
}

/** Count hours attributed to a (person, squad) within an effective window. */
export function countHoursByPersonSquadWindow(
  personId: number,
  squadId: number,
  from: Date,
  to: Date | null,
  db: Db = prisma
): Promise<number> {
  return db.hourRecord.count({
    where: { personId, squadId, date: { gte: from, ...(to ? { lte: to } : {}) } },
  });
}

/** Count all hour records for a client (currency-immutability guard). */
export function countHoursByClient(clientId: number, db: Db = prisma): Promise<number> {
  return db.hourRecord.count({ where: { clientId } });
}

/**
 * List the externalRefs already stored among the given refs (sync dedup).
 * Empty → [].
 */
export function listExistingHourRecordRefs(externalRefs: string[], db: Db = prisma) {
  return db.hourRecord.findMany({
    where: { externalRef: { in: externalRefs } },
    select: { externalRef: true },
  });
}

/** Bulk-insert hour records, skipping duplicates (sync ingest). */
export function createHourRecordsBatch(data: Prisma.HourRecordCreateManyInput[], db: Db = prisma) {
  return db.hourRecord.createMany({ data, skipDuplicates: true });
}
