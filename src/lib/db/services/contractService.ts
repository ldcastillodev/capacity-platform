import prisma from "@/lib/prisma";
import { ContractStatus, ContractType, Prisma } from "@prisma/client";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";
import type { Db } from "../types";
import { ConflictError } from "../errors";
import * as componentMappingService from "./componentMappingService";

/** Contract + StatementOfWork queries. */

// ─── Contracts ───────────────────────────────────────────────────────────────

const contractWithSowSummaryArgs = {
  select: {
    id: true,
    name: true,
    sowId: true,
    hourType: true,
    type: true,
    assignedHours: true,
    startDate: true,
    endDate: true,
    status: true,
    sow: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
  },
} satisfies Prisma.ContractDefaultArgs;
/** A contract with its SOW + client summary (management list/detail shape). */
export type ContractWithSowSummary = Prisma.ContractGetPayload<typeof contractWithSowSummaryArgs>;

/** An active contract joined to its SOW + client (analytics-by-month shape). */
export type ContractForMonth = Prisma.ContractGetPayload<{
  include: { sow: { include: { client: { select: { id: true; name: true } } } } };
}>;

/**
 * List active contracts (with SOW client summary), optionally scoped to a
 * client. Newest first. Empty → [].
 */
export function listActiveContracts(filters: { clientId?: number }, db: Db = prisma) {
  return db.contract.findMany({
    where: {
      status: ContractStatus.active,
      ...(filters.clientId ? { sow: { clientId: filters.clientId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { sow: { select: { clientId: true, name: true } } },
  });
}

/** Create a contract (returns the full record). */
export function createContract(data: Prisma.ContractUncheckedCreateInput, db: Db = prisma) {
  return db.contract.create({ data });
}

/** Find a contract with its SOW and declarations, or null. */
export function findContractWithSowAndDeclarations(id: number, db: Db = prisma) {
  return db.contract.findUnique({
    where: { id },
    include: { sow: true, declarations: true },
  });
}

/** Find a contract with its SOW's clientId (declaration creation), or null. */
export function findContractWithClientId(id: number, db: Db = prisma) {
  return db.contract.findUnique({
    where: { id },
    include: { sow: { select: { clientId: true } } },
  });
}

/**
 * List managed contracts (with SOW client summary), optionally scoped to a SOW.
 * Closed contracts excluded unless `includeArchived`. Empty → [].
 */
export function listManagedContracts(
  filters: { sowId?: number; includeArchived?: boolean },
  db: Db = prisma
): Promise<ContractWithSowSummary[]> {
  return db.contract.findMany({
    where: {
      ...(filters.sowId ? { sowId: filters.sowId } : {}),
      ...(filters.includeArchived ? {} : { status: { not: ContractStatus.closed } }),
    },
    orderBy: [{ sowId: "asc" }, { startDate: "asc" }],
    ...contractWithSowSummaryArgs,
  });
}

/** Create a contract, returning the SOW client summary shape. */
export function createManagedContract(
  data: Prisma.ContractUncheckedCreateInput,
  db: Db = prisma
): Promise<ContractWithSowSummary> {
  return db.contract.create({ data, ...contractWithSowSummaryArgs });
}

/** Update a contract, returning the SOW client summary shape. */
export function updateContract(
  id: number,
  data: Prisma.ContractUncheckedUpdateInput,
  db: Db = prisma
): Promise<ContractWithSowSummary> {
  return db.contract.update({ where: { id }, data, ...contractWithSowSummaryArgs });
}

/** Set a single contract's status (archive → closed, unarchive → active). */
export function setContractStatus(id: number, status: ContractStatus, db: Db = prisma) {
  return db.contract.update({ where: { id }, data: { status } });
}

/**
 * List active contracts effective in the given month (started on/before the
 * month, not ended before it), joined to SOW + client. Empty → [].
 */
export function listActiveContractsForMonth(
  monthStart: Date,
  db: Db = prisma
): Promise<ContractForMonth[]> {
  return db.contract.findMany({
    where: {
      status: ContractStatus.active,
      startDate: { lte: monthStart },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
    include: { sow: { include: { client: { select: { id: true, name: true } } } } },
  });
}

/** List contracts by id with name + SOW client name. Empty → []. */
export function listContractsByIds(ids: number[], db: Db = prisma) {
  return db.contract.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      sow: { select: { clientId: true, client: { select: { name: true } } } },
    },
  });
}

/** List all contracts (id, name, sowId) for filter dropdowns. Empty → []. */
export function listContractFilterOptions(db: Db = prisma) {
  return db.contract.findMany({
    select: { id: true, name: true, sowId: true },
    orderBy: { name: "asc" },
  });
}

/**
 * List contracts with assigned hours and child contract types, for the sync's
 * remaining-pool computation. Empty → [].
 */
export function listContractsForSync(db: Db = prisma) {
  return db.contract.findMany({
    select: {
      id: true,
      assignedHours: true,
      childContracts: { select: { id: true, type: true } },
    },
  });
}

/**
 * Close active contracts whose own endDate or whose SOW endDate has passed.
 * Idempotent. Returns the Prisma batch payload (`.count`).
 */
export function closeExpiredContracts(today: Date, db: Db = prisma) {
  return db.contract.updateMany({
    where: {
      status: ContractStatus.active,
      OR: [{ endDate: { lt: today } }, { sow: { endDate: { lt: today } } }],
    },
    data: { status: ContractStatus.closed },
  });
}

/** Close all non-closed contracts among the given ids (SOW renewal). */
export function closeContractsByIds(ids: number[], db: Db = prisma) {
  return db.contract.updateMany({
    where: { id: { in: ids }, status: { not: ContractStatus.closed } },
    data: { status: ContractStatus.closed },
  });
}

/** Close all non-closed contracts under a SOW (SOW archive cascade). */
export function closeContractsBySow(sowId: number, db: Db = prisma) {
  return db.contract.updateMany({
    where: { sowId, status: { not: ContractStatus.closed } },
    data: { status: ContractStatus.closed },
  });
}

/** Close all non-closed contracts under any of the given SOWs (client archive cascade). */
export function closeContractsBySowIds(sowIds: number[], db: Db = prisma) {
  return db.contract.updateMany({
    where: { sowId: { in: sowIds }, status: { not: ContractStatus.closed } },
    data: { status: ContractStatus.closed },
  });
}

// ─── Statements of Work ──────────────────────────────────────────────────────

const sowListArgs = {
  select: {
    id: true,
    name: true,
    clientId: true,
    isActive: true,
    startDate: true,
    endDate: true,
    client: { select: { id: true, name: true } },
  },
} satisfies Prisma.StatementOfWorkDefaultArgs;
/** A SOW with its client summary (management list shape). */
export type StatementOfWorkWithClient = Prisma.StatementOfWorkGetPayload<typeof sowListArgs>;

/**
 * List statements of work (with client), optionally scoped to a client.
 * Inactive excluded unless `includeArchived`. Empty → [].
 */
export function listStatementsOfWork(
  filters: { clientId?: number; includeArchived?: boolean },
  db: Db = prisma
): Promise<StatementOfWorkWithClient[]> {
  return db.statementOfWork.findMany({
    where: {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.includeArchived ? {} : { isActive: true }),
    },
    orderBy: [{ clientId: "asc" }, { startDate: "asc" }],
    ...sowListArgs,
  });
}

/** Create a SOW, returning the client summary shape. */
export function createStatementOfWork(
  data: Prisma.StatementOfWorkUncheckedCreateInput,
  db: Db = prisma
): Promise<StatementOfWorkWithClient> {
  return db.statementOfWork.create({ data, ...sowListArgs });
}

/** Update a SOW, returning id/name/client/dates. */
export function updateStatementOfWork(
  id: number,
  data: Prisma.StatementOfWorkUncheckedUpdateInput,
  db: Db = prisma
) {
  return db.statementOfWork.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      endDate: true,
      client: { select: { id: true, name: true } },
    },
  });
}

/** Set a SOW's active flag (archive → false, unarchive → true). */
export function setStatementOfWorkActive(id: number, isActive: boolean, db: Db = prisma) {
  return db.statementOfWork.update({ where: { id }, data: { isActive } });
}

/** Find a SOW with its contracts (id/name/hourType) for renewal, or null. */
export function findStatementOfWorkForRenewal(id: number, db: Db = prisma) {
  return db.statementOfWork.findUnique({
    where: { id },
    include: { contracts: { select: { id: true, name: true, hourType: true } } },
  });
}

/** Create the successor SOW linked to its parent (renewal). Returns full row. */
export function createRenewalStatementOfWork(
  data: Prisma.StatementOfWorkUncheckedCreateInput,
  db: Db = prisma
) {
  return db.statementOfWork.create({ data });
}

/** Find a SOW with its successor contracts, or null (renewal result). */
export function findStatementOfWorkWithContracts(id: number, db: Db = prisma) {
  return db.statementOfWork.findUnique({
    where: { id },
    include: {
      contracts: { select: { id: true, name: true, assignedHours: true, parentContractId: true } },
    },
  });
}

/** List all SOWs (id, name, clientId) for filter dropdowns. Empty → []. */
export function listStatementOfWorkFilterOptions(db: Db = prisma) {
  return db.statementOfWork.findMany({
    select: { id: true, name: true, clientId: true },
    orderBy: { name: "asc" },
  });
}

/** List a client's SOWs (id only) for archive cascade. Empty → []. */
export function listStatementOfWorkIdsByClient(clientId: number, db: Db = prisma) {
  return db.statementOfWork.findMany({ where: { clientId }, select: { id: true } });
}

// ─── Transactions ────────────────────────────────────────────────────────────

/** Fields for renewing a SOW: the carried-forward contracts and new dates. */
export type RenewStatementOfWorkInput = {
  name?: string;
  startDate: Date;
  endDate: Date | null;
  contracts: Array<{ id: number; assignedHours: number }>;
};

/**
 * BR-7: atomically renew a SOW. Creates a successor SOW (linked via parentSowId)
 * with successor contracts (linked via parentContractId) for each carried-forward
 * contract, re-points the old contracts' open component mappings to the
 * successors at the renewal boundary, and closes the old contracts. The old SOW
 * is preserved as history.
 * @param oldSowId - the SOW being renewed.
 * @param input - new name/dates and the carried-forward contracts with new hours.
 * @returns the new SOW with its successor contracts.
 * @throws {ConflictError} if the SOW is missing, a contract does not belong to it,
 *   or an open mapping starts on/after the renewal date.
 */
export function renewStatementOfWork(oldSowId: number, input: RenewStatementOfWorkInput) {
  const mappingEnd = addUtcDays(input.startDate, -1);
  return prisma.$transaction(async (tx) => {
    const oldSow = await findStatementOfWorkForRenewal(oldSowId, tx);
    if (!oldSow) throw new ConflictError("Statement of work not found.");

    const oldContractById = new Map(oldSow.contracts.map((c) => [c.id, c]));
    for (const c of input.contracts) {
      if (!oldContractById.has(c.id)) {
        throw new ConflictError(`Contract ${c.id} does not belong to this statement of work.`);
      }
    }

    const newSow = await createRenewalStatementOfWork(
      {
        name: input.name ?? oldSow.name,
        clientId: oldSow.clientId,
        startDate: input.startDate,
        endDate: input.endDate,
        parentSowId: oldSow.id,
      },
      tx
    );

    // Successor contracts for the carried-forward ones.
    const successorByOldId = new Map<number, number>();
    for (const c of input.contracts) {
      const old = oldContractById.get(c.id)!;
      const successor = await createContract(
        {
          name: old.name,
          sowId: newSow.id,
          hourType: old.hourType,
          type: ContractType.base,
          assignedHours: c.assignedHours,
          startDate: input.startDate,
          endDate: input.endDate,
          status: ContractStatus.active,
          parentContractId: old.id,
        },
        tx
      );
      successorByOldId.set(old.id, successor.id);
    }

    // Split mappings at the renewal boundary: end-date open mappings of all old
    // contracts; re-create them against the successor where one exists.
    const oldContractIds = oldSow.contracts.map((c) => c.id);
    const openMappings = await componentMappingService.findOpenMappingsForContracts(
      oldContractIds,
      tx
    );
    for (const m of openMappings) {
      if (m.effectiveFrom >= input.startDate) {
        throw new ConflictError(
          `Mapping for component "${m.componentKey}" starts on/after the renewal date; adjust it first.`
        );
      }
      await componentMappingService.endDateComponentMapping(m.id, mappingEnd, tx);
      const successorId = successorByOldId.get(m.contractId);
      if (successorId !== undefined) {
        await componentMappingService.createComponentMapping(
          {
            jiraInstance: m.jiraInstance,
            componentKey: m.componentKey,
            contractId: successorId,
            effectiveFrom: input.startDate,
          },
          tx
        );
      }
    }

    await closeContractsByIds(oldContractIds, tx);

    return findStatementOfWorkWithContracts(newSow.id, tx);
  });
}

/**
 * Atomically archive a SOW and cascade (mirrors client archive, one level down):
 * close every non-closed contract under it, end-date those contracts' open
 * component mappings as of today, then clear the SOW's active flag.
 * @param sowId - the SOW to archive.
 */
export function archiveStatementOfWorkCascade(sowId: number) {
  const today = toUtcDateOnly(new Date());
  return prisma.$transaction(async (tx) => {
    await closeContractsBySow(sowId, tx);
    await componentMappingService.endOpenMappingsBySow(sowId, today, tx);
    await setStatementOfWorkActive(sowId, false, tx);
  });
}
