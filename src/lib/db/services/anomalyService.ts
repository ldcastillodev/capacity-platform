import prisma from "@/lib/prisma";
import {
  Prisma,
  SuggestionStatus,
  type AnomalyFlagType,
  type RoleType,
  type SuggestionType,
} from "@prisma/client";
import type { Db } from "../types";

/** AnomalyFlag + NonBillableEnhancementSuggestion queries. */

// ─── Anomaly Flags ───────────────────────────────────────────────────────────

/**
 * List anomaly flags (with squad + client), filtered by month/squad and
 * optionally open-only. Severity then month, both descending. Empty → [].
 */
export function listAnomalyFlags(
  filters: { month?: Date; squadId?: number; openOnly?: boolean },
  db: Db = prisma
) {
  return db.anomalyFlag.findMany({
    where: {
      ...(filters.month ? { month: filters.month } : {}),
      ...(filters.squadId ? { squadId: filters.squadId } : {}),
      ...(filters.openOnly ? { resolvedAt: null } : {}),
    },
    include: { squad: true, client: true },
    orderBy: [{ severity: "desc" }, { month: "desc" }],
  });
}

/** Resolve an anomaly flag (stamp resolvedAt + notes). Returns the full record. */
export function resolveAnomalyFlag(id: number, resolutionNotes: string | null, db: Db = prisma) {
  return db.anomalyFlag.update({
    where: { id },
    data: { resolvedAt: new Date(), resolutionNotes },
  });
}

/**
 * List managed anomaly flags (with client summary), scoped by client and
 * resolved-state. Newest first, capped at 500. Empty → [].
 */
export function listManagedAnomalyFlags(
  filters: { clientId?: number; resolved?: boolean },
  db: Db = prisma
) {
  return db.anomalyFlag.findMany({
    where: {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.resolved === true ? { resolvedAt: { not: null } } : {}),
      ...(filters.resolved === false ? { resolvedAt: null } : {}),
    },
    orderBy: { detectedAt: "desc" },
    take: 500,
    select: {
      id: true,
      clientId: true,
      squadId: true,
      month: true,
      roleType: true,
      flagType: true,
      severity: true,
      explanation: true,
      detectedAt: true,
      resolvedAt: true,
      resolvedBy: true,
      resolutionNotes: true,
      client: { select: { id: true, name: true } },
      squad: { select: { id: true, name: true } },
    },
  });
}

/** Find an anomaly flag by id, or null. */
export function findAnomalyFlagById(id: number, db: Db = prisma) {
  return db.anomalyFlag.findUnique({ where: { id } });
}

/** Resolve an anomaly flag with the resolving user. Returns a resolution subset. */
export function resolveAnomalyFlagWithUser(
  id: number,
  resolvedBy: number | null,
  resolutionNotes: string,
  db: Db = prisma
) {
  return db.anomalyFlag.update({
    where: { id },
    data: { resolvedAt: new Date(), resolvedBy, resolutionNotes },
    select: {
      id: true,
      clientId: true,
      flagType: true,
      severity: true,
      resolvedAt: true,
      resolvedBy: true,
      resolutionNotes: true,
    },
  });
}

/** Find an open (unresolved) anomaly matching the identity tuple, or null. */
export function findOpenAnomaly(
  clientId: number,
  month: Date,
  roleType: RoleType | null,
  flagType: AnomalyFlagType,
  db: Db = prisma
) {
  return db.anomalyFlag.findFirst({
    where: { clientId, month, flagType, roleType, resolvedAt: null },
  });
}

/** Create an anomaly flag. */
export function createAnomalyFlag(data: Prisma.AnomalyFlagUncheckedCreateInput, db: Db = prisma) {
  return db.anomalyFlag.create({ data });
}

/** Count open (unresolved) anomaly flags for a month (dashboard metric). */
export function countOpenAnomalyFlags(month: Date, db: Db = prisma): Promise<number> {
  return db.anomalyFlag.count({ where: { month, resolvedAt: null } });
}

// ─── Enhancement Suggestions ─────────────────────────────────────────────────

/**
 * List enhancement suggestions (with person + squad), filtered by squad/month.
 * Newest month then squad. (Status filtering is applied by the caller.) Empty → [].
 */
export function listSuggestions(filters: { squadId?: number; month?: Date }, db: Db = prisma) {
  return db.nonBillableEnhancementSuggestion.findMany({
    where: {
      ...(filters.squadId ? { squadId: filters.squadId } : {}),
      ...(filters.month ? { month: filters.month } : {}),
    },
    include: { person: true, squad: true },
    orderBy: [{ month: "desc" }, { squadId: "asc" }],
  });
}

/** Update a suggestion's status. Returns the full record. */
export function updateSuggestionStatus(id: number, status: SuggestionStatus, db: Db = prisma) {
  return db.nonBillableEnhancementSuggestion.update({ where: { id }, data: { status } });
}

/**
 * List managed suggestions (with person + squad summaries), scoped by status
 * and month. Newest first, capped at 500. Empty → [].
 */
export function listManagedSuggestions(
  filters: { status?: SuggestionStatus; month?: Date },
  db: Db = prisma
) {
  return db.nonBillableEnhancementSuggestion.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.month ? { month: filters.month } : {}),
    },
    orderBy: { detectedAt: "desc" },
    take: 500,
    select: {
      id: true,
      personId: true,
      squadId: true,
      month: true,
      suggestionType: true,
      status: true,
      explanation: true,
      suggestedAction: true,
      suggestedHours: true,
      currentHours: true,
      detectedAt: true,
      resolvedAt: true,
      resolvedBy: true,
      person: { select: { id: true, name: true } },
      squad: { select: { id: true, name: true } },
    },
  });
}

/** Find a suggestion by id, or null. */
export function findSuggestionById(id: number, db: Db = prisma) {
  return db.nonBillableEnhancementSuggestion.findUnique({ where: { id } });
}

/**
 * Update a suggestion's status (with optional resolution stamp). Returns
 * id/status/resolvedAt/resolvedBy.
 */
export function updateManagedSuggestionStatus(
  id: number,
  data: Prisma.NonBillableEnhancementSuggestionUncheckedUpdateInput,
  db: Db = prisma
) {
  return db.nonBillableEnhancementSuggestion.update({
    where: { id },
    data,
    select: { id: true, status: true, resolvedAt: true, resolvedBy: true },
  });
}

/** Find an open suggestion matching the identity tuple, or null. */
export function findOpenSuggestion(
  personId: number,
  squadId: number | null,
  month: Date,
  suggestionType: SuggestionType,
  db: Db = prisma
) {
  return db.nonBillableEnhancementSuggestion.findFirst({
    where: { personId, squadId, month, suggestionType, status: SuggestionStatus.open },
  });
}

/** Create an enhancement suggestion. */
export function createSuggestion(
  data: Prisma.NonBillableEnhancementSuggestionUncheckedCreateInput,
  db: Db = prisma
) {
  return db.nonBillableEnhancementSuggestion.create({ data });
}
