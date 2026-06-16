import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { RoleType, Seniority } from "@prisma/client";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";
import type { Db } from "../types";
import { ConflictError } from "../errors";
import * as squadService from "./squadService";

/** Person + PersonCapacityHistory + PersonRole queries. */

// ─── Persons ─────────────────────────────────────────────────────────────────

const personSummarySelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  weeklyCapacityHours: true,
} satisfies Prisma.PersonSelect;
/** Person list/detail summary fields. */
export type PersonSummary = Prisma.PersonGetPayload<{ select: typeof personSummarySelect }>;

const personWithMembershipArgs = {
  select: {
    ...personSummarySelect,
    squadMemberships: {
      where: { effectiveTo: null },
      select: {
        id: true,
        squadId: true,
        allocationPct: true,
        effectiveFrom: true,
        squad: { select: { id: true, name: true } },
      },
      orderBy: { effectiveFrom: "desc" },
      take: 1,
    },
  },
} satisfies Prisma.PersonDefaultArgs;
/** A person with their single current (open) squad membership. */
export type PersonWithMembership = Prisma.PersonGetPayload<typeof personWithMembershipArgs>;

/** List people (summary fields), optionally filtered by active flag. Empty → []. */
export function listPersons(
  filters: { isActive?: boolean },
  db: Db = prisma
): Promise<PersonSummary[]> {
  return db.person.findMany({
    where: filters.isActive !== undefined ? { isActive: filters.isActive } : undefined,
    orderBy: { name: "asc" },
    select: personSummarySelect,
  });
}

/** Create a person, returning summary fields. */
export function createPerson(
  data: Prisma.PersonUncheckedCreateInput,
  db: Db = prisma
): Promise<PersonSummary> {
  return db.person.create({ data, select: personSummarySelect });
}

/** Create a person, returning the full record (used inside a transaction). */
export function createPersonRecord(data: Prisma.PersonUncheckedCreateInput, db: Db = prisma) {
  return db.person.create({ data });
}

/** Find a person (summary fields) by id, or null. */
export function findPersonSummary(id: number, db: Db = prisma): Promise<PersonSummary | null> {
  return db.person.findUnique({ where: { id }, select: personSummarySelect });
}

/** Update a person, returning summary fields. */
export function updatePerson(
  id: number,
  data: Prisma.PersonUncheckedUpdateInput,
  db: Db = prisma
): Promise<PersonSummary> {
  return db.person.update({ where: { id }, data, select: personSummarySelect });
}

/**
 * List managed people (summary + their single current squad membership).
 * Inactive excluded unless `includeArchived`. Empty → [].
 */
export function listManagedPersons(
  filters: { includeArchived?: boolean },
  db: Db = prisma
): Promise<PersonWithMembership[]> {
  return db.person.findMany({
    where: filters.includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    ...personWithMembershipArgs,
  });
}

/** Find a person with their single current squad membership, or null. */
export function findPersonWithMembership(
  id: number,
  db: Db = prisma
): Promise<PersonWithMembership | null> {
  return db.person.findUnique({ where: { id }, ...personWithMembershipArgs });
}

/** Set a person's active flag (archive → false, unarchive → true). */
export function setPersonActive(id: number, isActive: boolean, db: Db = prisma) {
  return db.person.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
}

/** List all persons (full records) for the sync's email lookup. Empty → []. */
export function listPersonsForSync(db: Db = prisma) {
  return db.person.findMany();
}

/** List people's weekly capacity by id (analytics denominator). Empty → []. */
export function listPersonCapacitiesByIds(ids: number[], db: Db = prisma) {
  return db.person.findMany({
    where: { id: { in: ids } },
    select: { id: true, weeklyCapacityHours: true },
  });
}

/** Count active people (dashboard metric). */
export function countActivePersons(db: Db = prisma): Promise<number> {
  return db.person.count({ where: { isActive: true } });
}

/** List active people (id, name) for filter dropdowns. Empty → []. */
export function listActivePersonOptions(db: Db = prisma) {
  return db.person.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ─── PersonCapacityHistory ───────────────────────────────────────────────────

/** Find a person's open (un-ended) capacity row, newest first, or null. */
export function findOpenCapacityRow(personId: number, db: Db = prisma) {
  return db.personCapacityHistory.findFirst({
    where: { personId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** Create a capacity-history row. */
export function createCapacityRow(
  data: Prisma.PersonCapacityHistoryUncheckedCreateInput,
  db: Db = prisma
) {
  return db.personCapacityHistory.create({ data });
}

/** Update a capacity-history row (correct hours or end-date it). */
export function updateCapacityRow(
  id: number,
  data: Prisma.PersonCapacityHistoryUncheckedUpdateInput,
  db: Db = prisma
) {
  return db.personCapacityHistory.update({ where: { id }, data });
}

/**
 * List capacity-history rows effective during a month for the given people
 * (analytics pro-rates by day). Empty → [].
 */
export function listCapacityHistoryForMonth(
  personIds: number[],
  monthStart: Date,
  monthEnd: Date,
  db: Db = prisma
) {
  return db.personCapacityHistory.findMany({
    where: {
      personId: { in: personIds },
      effectiveFrom: { lte: monthEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
    },
  });
}

// ─── PersonRoles ─────────────────────────────────────────────────────────────

const personRoleWithPersonArgs = {
  select: {
    id: true,
    personId: true,
    roleType: true,
    seniority: true,
    effectiveFrom: true,
    effectiveTo: true,
    person: { select: { id: true, name: true } },
  },
} satisfies Prisma.PersonRoleDefaultArgs;
/** A person-role row joined to its person summary. */
export type PersonRoleWithPerson = Prisma.PersonRoleGetPayload<typeof personRoleWithPersonArgs>;

/** List person-roles (with person), optionally for one person. Newest first. Empty → []. */
export function listPersonRoles(
  filters: { personId?: number },
  db: Db = prisma
): Promise<PersonRoleWithPerson[]> {
  return db.personRole.findMany({
    where: filters.personId ? { personId: filters.personId } : undefined,
    orderBy: { effectiveFrom: "desc" },
    ...personRoleWithPersonArgs,
  });
}

/** List all person-roles (full rows) for the sync. Newest first. Empty → []. */
export function listPersonRolesForSync(db: Db = prisma) {
  return db.personRole.findMany({ orderBy: { effectiveFrom: "desc" } });
}

/** Find a person's open (un-ended) roles. Empty → []. */
export function listOpenRolesForPerson(personId: number, db: Db = prisma) {
  return db.personRole.findMany({ where: { personId, effectiveTo: null } });
}

/** Find a person-role by id, or null. */
export function findPersonRoleById(id: number, db: Db = prisma) {
  return db.personRole.findUnique({ where: { id } });
}

/** Create a person-role (returns the full record). */
export function createPersonRole(data: Prisma.PersonRoleUncheckedCreateInput, db: Db = prisma) {
  return db.personRole.create({ data });
}

/** Create a person-role, returning it joined to its person. */
export function createPersonRoleWithPerson(
  data: Prisma.PersonRoleUncheckedCreateInput,
  db: Db = prisma
): Promise<PersonRoleWithPerson> {
  return db.personRole.create({ data, ...personRoleWithPersonArgs });
}

/** Update a person-role, returning it joined to its person. */
export function updatePersonRole(
  id: number,
  data: Prisma.PersonRoleUncheckedUpdateInput,
  db: Db = prisma
): Promise<PersonRoleWithPerson> {
  return db.personRole.update({ where: { id }, data, ...personRoleWithPersonArgs });
}

/** End-date a person-role (close prior on supersede, or soft-delete). */
export function endDatePersonRole(id: number, effectiveTo: Date, db: Db = prisma) {
  return db.personRole.update({ where: { id }, data: { effectiveTo } });
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * Version a person's capacity history for a new weekly value: if no open row
 * exists, start one today; if the value changed, correct a row that already
 * starts today in place, otherwise end-date the open row yesterday and start a
 * new one — so historical months keep the capacity that was true at the time.
 * No-op when the value is unchanged. Runs against the supplied transaction client.
 */
async function applyCapacityChange(personId: number, weeklyCapacityHours: number, tx: Db) {
  const today = toUtcDateOnly(new Date());
  const open = await findOpenCapacityRow(personId, tx);
  if (!open) {
    await createCapacityRow({ personId, weeklyCapacityHours, effectiveFrom: today }, tx);
  } else if (Number(open.weeklyCapacityHours) !== weeklyCapacityHours) {
    if (open.effectiveFrom >= today) {
      await updateCapacityRow(open.id, { weeklyCapacityHours }, tx);
    } else {
      await updateCapacityRow(open.id, { effectiveTo: addUtcDays(today, -1) }, tx);
      await createCapacityRow({ personId, weeklyCapacityHours, effectiveFrom: today }, tx);
    }
  }
}

/**
 * End-date a person's open roles that precede `effectiveFrom`. Throws
 * {@link ConflictError} if an open role starts on/after it. Runs against the
 * supplied transaction client.
 */
async function closeOverlappingRoles(tx: Db, personId: number, effectiveFrom: Date) {
  const priorEnd = addUtcDays(effectiveFrom, -1);
  const openRows = await listOpenRolesForPerson(personId, tx);
  for (const prior of openRows) {
    if (prior.effectiveFrom >= effectiveFrom) {
      throw new ConflictError(
        `Person already has a role starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`
      );
    }
    await endDatePersonRole(prior.id, priorEnd, tx);
  }
}

/** Fields needed to add a new person-role. */
export type NewPersonRole = {
  personId: number;
  roleType: RoleType;
  seniority: Seniority | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

/**
 * Atomically close a person's overlapping open roles and create the new one,
 * returned joined to its person (management shape).
 * @param input - person, role type, seniority and effective date.
 * @returns the created role joined to its person.
 * @throws {ConflictError} if an open role starts on/after `effectiveFrom`.
 */
export function createManagedPersonRoleWithOverlapResolution(
  input: NewPersonRole
): Promise<PersonRoleWithPerson> {
  return prisma.$transaction(async (tx) => {
    await closeOverlappingRoles(tx, input.personId, input.effectiveFrom);
    return createPersonRoleWithPerson(
      {
        personId: input.personId,
        roleType: input.roleType,
        seniority: input.seniority,
        effectiveFrom: input.effectiveFrom,
      },
      tx
    );
  });
}

/**
 * Atomically close a person's overlapping open roles and create the new one
 * (plain row; honours an optional `effectiveTo`).
 * @param input - person, role type, seniority and effective range.
 * @returns the created role.
 * @throws {ConflictError} if an open role starts on/after `effectiveFrom`.
 */
export function createPersonRoleWithOverlapResolution(input: NewPersonRole) {
  return prisma.$transaction(async (tx) => {
    await closeOverlappingRoles(tx, input.personId, input.effectiveFrom);
    return createPersonRole(
      {
        personId: input.personId,
        roleType: input.roleType,
        seniority: input.seniority,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
      },
      tx
    );
  });
}

/** Fields needed to create a person, optionally placing them in a squad. */
export type NewPerson = {
  name: string;
  email: string;
  weeklyCapacityHours?: number;
  squadId?: number | null;
  allocationPct?: number;
};

/**
 * Atomically create a person and, when a squad is given, an initial membership
 * starting today.
 * @param input - person fields plus optional squad + allocation.
 * @returns the created person with their single current squad membership.
 */
export function createPersonWithOptionalMembership(
  input: NewPerson
): Promise<PersonWithMembership | null> {
  return prisma.$transaction(async (tx) => {
    const p = await createPersonRecord(
      {
        name: input.name,
        email: input.email,
        weeklyCapacityHours: input.weeklyCapacityHours ?? 40,
      },
      tx
    );
    if (input.squadId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await squadService.createSquadMembership(
        {
          personId: p.id,
          squadId: input.squadId,
          allocationPct: input.allocationPct ?? 1.0,
          effectiveFrom: today,
        },
        tx
      );
    }
    return findPersonWithMembership(p.id, tx);
  });
}

/** Editable person fields plus capacity-only versioning. */
export type UpdatePersonCapacityInput = {
  name?: string;
  email?: string;
  isActive?: boolean;
  weeklyCapacityHours?: number;
};

/**
 * Atomically update a person's details and, when capacity changed, version the
 * capacity history.
 * @param personId - the person to update.
 * @param input - the changed fields (only provided keys are written).
 * @returns the updated person summary.
 */
export function updatePersonWithCapacityHistory(
  personId: number,
  input: UpdatePersonCapacityInput
): Promise<PersonSummary> {
  return prisma.$transaction(async (tx) => {
    const updated = await updatePerson(
      personId,
      {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.weeklyCapacityHours !== undefined && {
          weeklyCapacityHours: input.weeklyCapacityHours,
        }),
      },
      tx
    );
    if (input.weeklyCapacityHours !== undefined) {
      await applyCapacityChange(personId, input.weeklyCapacityHours, tx);
    }
    return updated;
  });
}

/** Editable person fields plus capacity versioning and a squad transition. */
export type UpdatePersonWithMembershipInput = {
  name?: string;
  email?: string;
  weeklyCapacityHours?: number;
  squadId?: number | null;
  allocationPct?: number;
};

/**
 * Atomically update a person's details, version capacity history when capacity
 * changed, and apply a squad transition when `squadId` is provided: prior open
 * memberships are closed yesterday, and a new one started today unless `squadId`
 * is null (a removal).
 * @param personId - the person to update.
 * @param input - the changed fields; `squadId` undefined = no membership change.
 * @returns the updated person with their single current squad membership.
 * @throws {ConflictError} if a prior membership already starts today.
 */
export function updatePersonWithCapacityAndMembership(
  personId: number,
  input: UpdatePersonWithMembershipInput
): Promise<PersonWithMembership | null> {
  return prisma.$transaction(async (tx) => {
    await updatePerson(
      personId,
      {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.weeklyCapacityHours !== undefined && {
          weeklyCapacityHours: input.weeklyCapacityHours,
        }),
      },
      tx
    );

    if (input.weeklyCapacityHours !== undefined) {
      await applyCapacityChange(personId, input.weeklyCapacityHours, tx);
    }

    if (input.squadId !== undefined) {
      const today = toUtcDateOnly(new Date());
      const yesterday = addUtcDays(today, -1);
      const openRows = await squadService.listOpenMembershipsForPerson(personId, tx);
      for (const prior of openRows) {
        if (prior.effectiveFrom >= today) {
          throw new ConflictError(
            "Person already has a membership starting today; cannot end-date it to yesterday."
          );
        }
        await squadService.endDateMembership(prior.id, yesterday, tx);
      }
      if (input.squadId !== null) {
        await squadService.createSquadMembership(
          {
            personId,
            squadId: input.squadId,
            allocationPct: input.allocationPct ?? 1.0,
            effectiveFrom: today,
          },
          tx
        );
      }
    }

    return findPersonWithMembership(personId, tx);
  });
}

/**
 * Atomically archive a person: end-date their open squad memberships as of
 * today, null out any squad-lead references to them, and clear their active flag.
 * @param personId - the person to archive.
 */
export function archivePersonCascade(personId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.$transaction(async (tx) => {
    await squadService.endOpenMembershipsForPerson(personId, today, tx);
    await squadService.clearSquadLeads(personId, tx);
    await setPersonActive(personId, false, tx);
  });
}
