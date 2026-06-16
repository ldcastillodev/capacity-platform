import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { toUtcDateOnly } from "@/lib/temporal";
import type { Db } from "../types";
import * as contractService from "./contractService";
import * as componentMappingService from "./componentMappingService";

/** Client queries. */

const clientSummarySelect = {
  id: true,
  name: true,
  region: true,
  currency: true,
  isActive: true,
} satisfies Prisma.ClientSelect;
/** Client summary fields. */
export type ClientSummary = Prisma.ClientGetPayload<{ select: typeof clientSummarySelect }>;

const clientManagedSelect = {
  ...clientSummarySelect,
  createdAt: true,
} satisfies Prisma.ClientSelect;
/** Client management fields (summary + createdAt). */
export type ManagedClient = Prisma.ClientGetPayload<{ select: typeof clientManagedSelect }>;

/** List all clients (summary fields), alphabetical. Empty → []. */
export function listClients(db: Db = prisma): Promise<ClientSummary[]> {
  return db.client.findMany({ orderBy: { name: "asc" }, select: clientSummarySelect });
}

/** Create a client, returning summary fields. */
export function createClient(
  data: Prisma.ClientUncheckedCreateInput,
  db: Db = prisma
): Promise<ClientSummary> {
  return db.client.create({ data, select: clientSummarySelect });
}

/**
 * List managed clients (summary + createdAt). Inactive excluded unless
 * `includeArchived`. Empty → [].
 */
export function listManagedClients(
  filters: { includeArchived?: boolean },
  db: Db = prisma
): Promise<ManagedClient[]> {
  return db.client.findMany({
    where: filters.includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    select: clientManagedSelect,
  });
}

/** Create a client, returning management fields. */
export function createManagedClient(
  data: Prisma.ClientUncheckedCreateInput,
  db: Db = prisma
): Promise<ManagedClient> {
  return db.client.create({ data, select: clientManagedSelect });
}

/** Update a client, returning management fields. */
export function updateClient(
  id: number,
  data: Prisma.ClientUncheckedUpdateInput,
  db: Db = prisma
): Promise<ManagedClient> {
  return db.client.update({ where: { id }, data, select: clientManagedSelect });
}

/** Set a client's active flag (archive → false, unarchive → true). */
export function setClientActive(id: number, isActive: boolean, db: Db = prisma) {
  return db.client.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
}

/** List active client ids (anomaly detection scope). Empty → []. */
export function listActiveClientIds(db: Db = prisma) {
  return db.client.findMany({ where: { isActive: true }, select: { id: true } });
}

/** List clients by id (id + name). Empty → []. */
export function listClientsByIds(ids: number[], db: Db = prisma) {
  return db.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}

/** Count active clients (dashboard metric). */
export function countActiveClients(db: Db = prisma): Promise<number> {
  return db.client.count({ where: { isActive: true } });
}

/** List active clients (id, name) for filter dropdowns. Empty → []. */
export function listActiveClientOptions(db: Db = prisma) {
  return db.client.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * BR-5: atomically archive a client and cascade — close every non-closed
 * contract under its SOWs, end-date those contracts' open component mappings as
 * of today (so the sync guard stops routing worklogs here), then clear the
 * client's active flag.
 * @param clientId - the client to archive.
 */
export function archiveClientCascade(clientId: number) {
  const today = toUtcDateOnly(new Date());
  return prisma.$transaction(async (tx) => {
    const sowIds = (await contractService.listStatementOfWorkIdsByClient(clientId, tx)).map(
      (s) => s.id
    );
    if (sowIds.length > 0) {
      await contractService.closeContractsBySowIds(sowIds, tx);
      await componentMappingService.endOpenMappingsBySowIds(sowIds, today, tx);
    }
    await setClientActive(clientId, false, tx);
  });
}
