import prisma from "@/lib/prisma";
import { DeclarationStatus, Prisma, type RoleType } from "@prisma/client";
import type { Db } from "../types";

/**
 * ⚠ PLANNED hours only. MonthlyRoleDeclaration / DeclarationRoleEntry record
 * what was COMMITTED/PLANNED for a month — NOT actuals. Actual logged hours
 * live in HourRecord (see hourRecordService). Never read these models to answer
 * "how many hours were actually worked". The one cross-over —
 * `sumDeclaredHoursByContract` — is intentionally used elsewhere as the
 * committed monthly *pool* that actuals are compared against, not as actuals.
 */

// ─── MonthlyRoleDeclaration ──────────────────────────────────────────────────

/**
 * List declarations (with client/squad/contract + declared role hours) for a
 * month, or all months when `month` is omitted. Empty → [].
 */
export function listDeclarationsForMonth(month: Date | null, db: Db = prisma) {
  return db.monthlyRoleDeclaration.findMany({
    where: month ? { month } : {},
    orderBy: [{ month: "desc" }, { clientId: "asc" }],
    select: {
      id: true,
      contractId: true,
      clientId: true,
      squadId: true,
      month: true,
      status: true,
      client: { select: { id: true, name: true } },
      squad: { select: { id: true, name: true } },
      contract: { select: { id: true, name: true } },
      roles: { select: { roleType: true, declaredHours: true } },
    },
  });
}

/**
 * List a contract's declarations (with role entries), optionally for one month.
 * Newest month first. Empty → [].
 */
export function listDeclarationsByContract(
  contractId: number,
  month: Date | null,
  db: Db = prisma
) {
  return db.monthlyRoleDeclaration.findMany({
    where: { contractId, ...(month ? { month } : {}) },
    orderBy: [{ month: "desc" }],
    include: { roles: true },
  });
}

/** Find the existing declaration for a (contract, month), or null. */
export function findDeclarationByContractMonth(contractId: number, month: Date, db: Db = prisma) {
  return db.monthlyRoleDeclaration.findFirst({ where: { contractId, month } });
}

/** Create a declaration with its nested role entries; returns it with roles. */
export function createDeclarationWithRoles(
  data: Prisma.MonthlyRoleDeclarationUncheckedCreateInput,
  db: Db = prisma
) {
  return db.monthlyRoleDeclaration.create({ data, include: { roles: true } });
}

/**
 * List managed declarations (with client/squad/contract + role entries) scoped
 * by client and/or month. Newest month first. Empty → [].
 */
export function listManagedDeclarations(
  filters: { clientId?: number; month?: Date },
  db: Db = prisma
) {
  return db.monthlyRoleDeclaration.findMany({
    where: {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.month ? { month: filters.month } : {}),
    },
    orderBy: [{ month: "desc" }],
    select: {
      id: true,
      contractId: true,
      clientId: true,
      squadId: true,
      month: true,
      status: true,
      updatedAt: true,
      client: { select: { id: true, name: true } },
      squad: { select: { id: true, name: true } },
      contract: { select: { id: true, name: true } },
      roles: { select: { id: true, roleType: true, declaredHours: true } },
    },
  });
}

/** Find a declaration by id (plain row), or null. */
export function findDeclarationById(id: number, db: Db = prisma) {
  return db.monthlyRoleDeclaration.findUnique({ where: { id } });
}

/** Find a declaration with its role entries (edit-result shape), or null. */
export function findDeclarationWithRoles(id: number, db: Db = prisma) {
  return db.monthlyRoleDeclaration.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      squadId: true,
      month: true,
      status: true,
      updatedAt: true,
      roles: { select: { id: true, roleType: true, declaredHours: true } },
    },
  });
}

/** Set a declaration's status (e.g. confirm → confirmed). Returns id + status. */
export function setDeclarationStatus(id: number, status: DeclarationStatus, db: Db = prisma) {
  return db.monthlyRoleDeclaration.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  });
}

/**
 * List declarations (contractId, squadId, month) with a contract, within a
 * month range — used by the sync to resolve squad attribution. Empty → [].
 */
export function listDeclarationsForSync(monthFrom: Date, monthTo: Date, db: Db = prisma) {
  return db.monthlyRoleDeclaration.findMany({
    where: { contractId: { not: null }, month: { gte: monthFrom, lte: monthTo } },
    select: { contractId: true, squadId: true, month: true },
  });
}

// ─── DeclarationRoleEntry ────────────────────────────────────────────────────

/** Upsert a declaration's planned hours for a single role. */
export function upsertDeclarationRoleEntry(
  declarationId: number,
  roleType: RoleType,
  declaredHours: number,
  db: Db = prisma
) {
  return db.declarationRoleEntry.upsert({
    where: { declarationId_roleType: { declarationId, roleType } },
    update: { declaredHours },
    create: { declarationId, roleType, declaredHours },
  });
}

/**
 * Sum PLANNED declared hours for a (contract, month). ⚠ Used as the committed
 * monthly *pool* against which HourRecord actuals are compared — this is NOT a
 * read of actual hours.
 */
export function sumDeclaredHoursByContract(contractId: number, month: Date, db: Db = prisma) {
  return db.declarationRoleEntry.aggregate({
    where: { declaration: { contractId, month } },
    _sum: { declaredHours: true },
  });
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * Atomically upsert a declaration's PLANNED hours for each given role — all
 * roles persist together or none do. ⚠ PLANNED hours only; never touches
 * HourRecord actuals.
 * @param declarationId - the declaration whose role entries are being set.
 * @param roles - the role types and their declared (planned) hours.
 */
export function upsertDeclarationRoles(
  declarationId: number,
  roles: Array<{ roleType: RoleType; declaredHours: number }>
) {
  return prisma.$transaction(async (tx) => {
    for (const r of roles) {
      await upsertDeclarationRoleEntry(declarationId, r.roleType, r.declaredHours, tx);
    }
  });
}
