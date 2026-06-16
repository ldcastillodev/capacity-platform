import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { addUtcDays } from "@/lib/temporal";
import type { Db } from "../types";
import { ConflictError } from "../errors";

/** Squad + SquadMembership queries. */

// ─── Squads ──────────────────────────────────────────────────────────────────

const squadBasicSelect = { id: true, name: true, leadPersonId: true } satisfies Prisma.SquadSelect;
/** Basic squad fields (id, name, lead). */
export type SquadBasic = Prisma.SquadGetPayload<{ select: typeof squadBasicSelect }>;

const squadManagedArgs = {
  select: {
    id: true,
    name: true,
    isActive: true,
    leadPersonId: true,
    lead: { select: { id: true, name: true } },
    members: { where: { effectiveTo: null }, select: { id: true } },
  },
} satisfies Prisma.SquadDefaultArgs;
/** A squad with its lead and current member ids (management shape). */
export type ManagedSquad = Prisma.SquadGetPayload<typeof squadManagedArgs>;

/** List squads (basic fields), alphabetical. Empty → []. */
export function listSquads(db: Db = prisma): Promise<SquadBasic[]> {
  return db.squad.findMany({ orderBy: { name: "asc" }, select: squadBasicSelect });
}

/** Create a squad, returning basic fields. */
export function createSquad(
  data: Prisma.SquadUncheckedCreateInput,
  db: Db = prisma
): Promise<SquadBasic> {
  return db.squad.create({ data, select: squadBasicSelect });
}

/** Find a squad (basic fields) by id, or null. */
export function findSquadBasic(id: number, db: Db = prisma): Promise<SquadBasic | null> {
  return db.squad.findUnique({ where: { id }, select: squadBasicSelect });
}

/** Find a squad (full record) by id, or null. */
export function findSquadById(id: number, db: Db = prisma) {
  return db.squad.findUnique({ where: { id } });
}

/**
 * List managed squads (with lead + current member ids). Inactive excluded
 * unless `includeArchived`. Empty → [].
 */
export function listManagedSquads(
  filters: { includeArchived?: boolean },
  db: Db = prisma
): Promise<ManagedSquad[]> {
  return db.squad.findMany({
    where: filters.includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    ...squadManagedArgs,
  });
}

/** Create a squad, returning the management shape. */
export function createManagedSquad(
  data: Prisma.SquadUncheckedCreateInput,
  db: Db = prisma
): Promise<ManagedSquad> {
  return db.squad.create({ data, ...squadManagedArgs });
}

/** Update a squad, returning the management shape. */
export function updateSquad(
  id: number,
  data: Prisma.SquadUncheckedUpdateInput,
  db: Db = prisma
): Promise<ManagedSquad> {
  return db.squad.update({ where: { id }, data, ...squadManagedArgs });
}

/** Set a squad's active flag (archive → false, unarchive → true). */
export function setSquadActive(id: number, isActive: boolean, db: Db = prisma) {
  return db.squad.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
}

/** Null out the lead on any squads led by a person (person archive). */
export function clearSquadLeads(personId: number, db: Db = prisma) {
  return db.squad.updateMany({ where: { leadPersonId: personId }, data: { leadPersonId: null } });
}

/** List active squads (id, name) for filter dropdowns. Empty → []. */
export function listActiveSquadOptions(db: Db = prisma) {
  return db.squad.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Count active squads (dashboard metric). */
export function countActiveSquads(db: Db = prisma): Promise<number> {
  return db.squad.count({ where: { isActive: true } });
}

// ─── SquadMemberships ────────────────────────────────────────────────────────

const membershipWithRefsArgs = {
  select: {
    id: true,
    personId: true,
    squadId: true,
    allocationPct: true,
    effectiveFrom: true,
    effectiveTo: true,
    person: { select: { id: true, name: true } },
    squad: { select: { id: true, name: true } },
  },
} satisfies Prisma.SquadMembershipDefaultArgs;
/** A membership joined to its person + squad summaries. */
export type MembershipWithRefs = Prisma.SquadMembershipGetPayload<typeof membershipWithRefsArgs>;

/** Create a squad membership (returns the full record). */
export function createSquadMembership(
  data: Prisma.SquadMembershipUncheckedCreateInput,
  db: Db = prisma
) {
  return db.squadMembership.create({ data });
}

/** Create a squad membership, returning person + squad summaries. */
export function createSquadMembershipWithRefs(
  data: Prisma.SquadMembershipUncheckedCreateInput,
  db: Db = prisma
): Promise<MembershipWithRefs> {
  return db.squadMembership.create({ data, ...membershipWithRefsArgs });
}

/**
 * List memberships (with person + squad), optionally scoped by squad and/or
 * person. Newest first. Empty → [].
 */
export function listSquadMemberships(
  filters: { squadId?: number; personId?: number },
  db: Db = prisma
): Promise<MembershipWithRefs[]> {
  return db.squadMembership.findMany({
    where: {
      ...(filters.squadId ? { squadId: filters.squadId } : {}),
      ...(filters.personId ? { personId: filters.personId } : {}),
    },
    orderBy: { effectiveFrom: "desc" },
    ...membershipWithRefsArgs,
  });
}

/** List all memberships (full rows) for the sync. Newest first. Empty → []. */
export function listMembershipsForSync(db: Db = prisma) {
  return db.squadMembership.findMany({ orderBy: { effectiveFrom: "desc" } });
}

/** Find a person's open (un-ended) memberships. Empty → []. */
export function listOpenMembershipsForPerson(personId: number, db: Db = prisma) {
  return db.squadMembership.findMany({ where: { personId, effectiveTo: null } });
}

/** Find a membership by id, or null. */
export function findMembershipById(id: number, db: Db = prisma) {
  return db.squadMembership.findUnique({ where: { id } });
}

/** Update a membership, returning person + squad summaries. */
export function updateSquadMembership(
  id: number,
  data: Prisma.SquadMembershipUncheckedUpdateInput,
  db: Db = prisma
): Promise<MembershipWithRefs> {
  return db.squadMembership.update({ where: { id }, data, ...membershipWithRefsArgs });
}

/** End-date a single membership (close prior on supersede, or soft-delete). */
export function endDateMembership(id: number, effectiveTo: Date, db: Db = prisma) {
  return db.squadMembership.update({ where: { id }, data: { effectiveTo } });
}

/** End-date all of a person's open memberships (person archive). */
export function endOpenMembershipsForPerson(personId: number, effectiveTo: Date, db: Db = prisma) {
  return db.squadMembership.updateMany({
    where: { personId, effectiveTo: null },
    data: { effectiveTo },
  });
}

/** End-date all of a squad's open memberships (squad archive). */
export function endOpenMembershipsForSquad(squadId: number, effectiveTo: Date, db: Db = prisma) {
  return db.squadMembership.updateMany({
    where: { squadId, effectiveTo: null },
    data: { effectiveTo },
  });
}

/** Find a person's effective membership in a squad as of a date, or null (lead guard). */
export function findActiveMembership(
  squadId: number,
  personId: number,
  asOf: Date,
  db: Db = prisma
) {
  return db.squadMembership.findFirst({
    where: {
      squadId,
      personId,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
  });
}

/** List all memberships effective as of a date (personId, squadId) for filters. Empty → []. */
export function listActiveMembershipPairs(asOf: Date, db: Db = prisma) {
  return db.squadMembership.findMany({
    where: {
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    select: { personId: true, squadId: true },
  });
}

// ─── Transactions ────────────────────────────────────────────────────────────

/** Fields needed to add a new squad membership. */
export type NewSquadMembership = {
  personId: number;
  squadId: number;
  allocationPct: number;
  effectiveFrom: Date;
};

/**
 * Atomically close the person's conflicting open memberships and create the new
 * one, returned with person + squad summaries. Prior open rows are closed always
 * for the same squad, and for other squads only on a full move (allocation ≥
 * 1.0) — partial allocations are intentional splits.
 * @param input - person, squad, allocation and effective date for the new membership.
 * @returns the created membership with person + squad summaries.
 * @throws {ConflictError} if a prior open membership starts on/after `effectiveFrom`.
 */
export function createMembershipWithOverlapResolution(
  input: NewSquadMembership
): Promise<MembershipWithRefs> {
  const priorEnd = addUtcDays(input.effectiveFrom, -1);
  return prisma.$transaction(async (tx) => {
    const openRows = await listOpenMembershipsForPerson(input.personId, tx);
    const toClose = openRows.filter(
      (r) => r.squadId === input.squadId || input.allocationPct >= 1.0
    );
    for (const prior of toClose) {
      if (prior.effectiveFrom >= input.effectiveFrom) {
        throw new ConflictError(
          `Person already has a membership starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`
        );
      }
      await endDateMembership(prior.id, priorEnd, tx);
    }
    return createSquadMembershipWithRefs(
      {
        personId: input.personId,
        squadId: input.squadId,
        allocationPct: input.allocationPct,
        effectiveFrom: input.effectiveFrom,
      },
      tx
    );
  });
}

/**
 * Atomically archive a squad: end-date all its open memberships as of today and
 * clear its active flag.
 * @param squadId - the squad to archive.
 */
export function archiveSquadCascade(squadId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.$transaction(async (tx) => {
    await endOpenMembershipsForSquad(squadId, today, tx);
    await setSquadActive(squadId, false, tx);
  });
}
