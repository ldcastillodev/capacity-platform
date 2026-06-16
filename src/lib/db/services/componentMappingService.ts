import prisma from "@/lib/prisma";
import { ContractStatus, Prisma } from "@prisma/client";
import { addUtcDays } from "@/lib/temporal";
import type { Db } from "../types";
import { ConflictError } from "../errors";

/** JiraComponentClientMapping queries (component → contract routing). */

const mappingWithContractSummaryArgs = {
  select: {
    id: true,
    jiraInstance: true,
    componentKey: true,
    contractId: true,
    effectiveFrom: true,
    effectiveTo: true,
    contract: { select: { id: true, name: true } },
  },
} satisfies Prisma.JiraComponentClientMappingDefaultArgs;
/** A mapping with its contract summary (management shape). */
export type MappingWithContractSummary = Prisma.JiraComponentClientMappingGetPayload<
  typeof mappingWithContractSummaryArgs
>;

/** List all mappings (with full contract), by component key. Empty → []. */
export function listComponentMappings(db: Db = prisma) {
  return db.jiraComponentClientMapping.findMany({
    include: { contract: true },
    orderBy: { componentKey: "asc" },
  });
}

/**
 * List managed mappings (with contract summary). Archived (already end-dated as
 * of today) excluded unless `includeArchived`. Empty → [].
 */
export function listManagedComponentMappings(
  filters: { includeArchived?: boolean; today: Date },
  db: Db = prisma
): Promise<MappingWithContractSummary[]> {
  return db.jiraComponentClientMapping.findMany({
    where: filters.includeArchived
      ? undefined
      : { OR: [{ effectiveTo: null }, { effectiveTo: { gt: filters.today } }] },
    orderBy: { componentKey: "asc" },
    ...mappingWithContractSummaryArgs,
  });
}

/** Find open (un-ended) mappings for a component on an instance. Empty → []. */
export function findOpenMappingsForComponent(
  jiraInstance: string,
  componentKey: string,
  db: Db = prisma
) {
  return db.jiraComponentClientMapping.findMany({
    where: { jiraInstance, componentKey, effectiveTo: null },
  });
}

/** Create a mapping, returning it with its full contract. */
export function createComponentMapping(
  data: Prisma.JiraComponentClientMappingUncheckedCreateInput,
  db: Db = prisma
) {
  return db.jiraComponentClientMapping.create({ data, include: { contract: true } });
}

/** Create a mapping, returning the contract summary shape. */
export function createManagedComponentMapping(
  data: Prisma.JiraComponentClientMappingUncheckedCreateInput,
  db: Db = prisma
): Promise<MappingWithContractSummary> {
  return db.jiraComponentClientMapping.create({ data, ...mappingWithContractSummaryArgs });
}

/** Find a mapping by id, or null. */
export function findComponentMappingById(id: number, db: Db = prisma) {
  return db.jiraComponentClientMapping.findUnique({ where: { id } });
}

/** Update a mapping, returning the contract summary shape. */
export function updateComponentMapping(
  id: number,
  data: Prisma.JiraComponentClientMappingUncheckedUpdateInput,
  db: Db = prisma
): Promise<MappingWithContractSummary> {
  return db.jiraComponentClientMapping.update({
    where: { id },
    data,
    ...mappingWithContractSummaryArgs,
  });
}

/** End-date a mapping (close prior on supersede, renewal split, or archive). */
export function endDateComponentMapping(id: number, effectiveTo: Date, db: Db = prisma) {
  return db.jiraComponentClientMapping.update({ where: { id }, data: { effectiveTo } });
}

/** Reopen a mapping (clear its end-date). Returns id/componentKey/effectiveTo. */
export function unarchiveComponentMapping(id: number, db: Db = prisma) {
  return db.jiraComponentClientMapping.update({
    where: { id },
    data: { effectiveTo: null },
    select: { id: true, componentKey: true, effectiveTo: true },
  });
}

/** Find open mappings for any of the given contracts (renewal split). Empty → []. */
export function findOpenMappingsForContracts(contractIds: number[], db: Db = prisma) {
  return db.jiraComponentClientMapping.findMany({
    where: { contractId: { in: contractIds }, effectiveTo: null },
  });
}

/** End-date open mappings under a SOW as of a date (SOW archive cascade). */
export function endOpenMappingsBySow(sowId: number, today: Date, db: Db = prisma) {
  return db.jiraComponentClientMapping.updateMany({
    where: { effectiveTo: null, effectiveFrom: { lte: today }, contract: { sowId } },
    data: { effectiveTo: today },
  });
}

/** End-date open mappings under any of the given SOWs (client archive cascade). */
export function endOpenMappingsBySowIds(sowIds: number[], today: Date, db: Db = prisma) {
  return db.jiraComponentClientMapping.updateMany({
    where: {
      effectiveTo: null,
      effectiveFrom: { lte: today },
      contract: { sowId: { in: sowIds } },
    },
    data: { effectiveTo: today },
  });
}

/** End-date open mappings whose contract is closed (expiry sweep). */
export function endOpenMappingsForClosedContracts(today: Date, db: Db = prisma) {
  return db.jiraComponentClientMapping.updateMany({
    where: {
      effectiveTo: null,
      effectiveFrom: { lte: today },
      contract: { status: ContractStatus.closed },
    },
    data: { effectiveTo: today },
  });
}

/**
 * List mappings with contract → SOW → client, newest first — the sync's
 * attribution lookup. Empty → [].
 */
export function listMappingsWithContractForSync(db: Db = prisma) {
  return db.jiraComponentClientMapping.findMany({
    include: { contract: { include: { sow: { include: { client: true } } } } },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** List all mappings (full rows) — sync JQL component filter. Empty → []. */
export function listAllComponentMappings(db: Db = prisma) {
  return db.jiraComponentClientMapping.findMany();
}

// ─── Transactions ────────────────────────────────────────────────────────────

/** Fields needed to add a new component → contract mapping. */
export type NewComponentMapping = {
  jiraInstance: string;
  componentKey: string;
  contractId: number;
  effectiveFrom: Date;
};

/**
 * BR-2: a component maps to exactly one contract at a time. End-date every open
 * mapping for the component that precedes `effectiveFrom`. Throws
 * {@link ConflictError} if an existing open mapping starts on/after it. Runs
 * against the supplied transaction client.
 */
async function closeOverlappingMappings(
  tx: Db,
  jiraInstance: string,
  componentKey: string,
  effectiveFrom: Date
) {
  const priorEnd = addUtcDays(effectiveFrom, -1);
  const openRows = await findOpenMappingsForComponent(jiraInstance, componentKey, tx);
  for (const prior of openRows) {
    if (prior.effectiveFrom >= effectiveFrom) {
      throw new ConflictError(
        `Component already has a mapping starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`
      );
    }
    await endDateComponentMapping(prior.id, priorEnd, tx);
  }
}

/**
 * Atomically end-date the prior open mapping for the component (BR-2) and create
 * the new one, returned with its full contract.
 * @param input - the new mapping's instance, component key, contract and effective date.
 * @returns the created mapping including its contract.
 * @throws {ConflictError} if an existing open mapping starts on/after `effectiveFrom`.
 */
export function createMappingWithOverlapResolution(input: NewComponentMapping) {
  return prisma.$transaction(async (tx) => {
    await closeOverlappingMappings(tx, input.jiraInstance, input.componentKey, input.effectiveFrom);
    return createComponentMapping(
      {
        componentKey: input.componentKey,
        contractId: input.contractId,
        jiraInstance: input.jiraInstance,
        effectiveFrom: input.effectiveFrom,
      },
      tx
    );
  });
}

/**
 * As {@link createMappingWithOverlapResolution}, but returns the management
 * contract-summary shape.
 * @param input - the new mapping's instance, component key, contract and effective date.
 * @returns the created mapping in the management summary shape.
 * @throws {ConflictError} if an existing open mapping starts on/after `effectiveFrom`.
 */
export function createManagedMappingWithOverlapResolution(
  input: NewComponentMapping
): Promise<MappingWithContractSummary> {
  return prisma.$transaction(async (tx) => {
    await closeOverlappingMappings(tx, input.jiraInstance, input.componentKey, input.effectiveFrom);
    return createManagedComponentMapping(
      {
        componentKey: input.componentKey,
        contractId: input.contractId,
        jiraInstance: input.jiraInstance,
        effectiveFrom: input.effectiveFrom,
      },
      tx
    );
  });
}
