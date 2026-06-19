/**
 * Centralized DB service layer. Every query in the app has a single named home
 * under `services/`, grouped by domain. Import a namespace and call its methods:
 *
 *   import { hourRecordService } from "@/lib/db";
 *   const rows = await hourRecordService.listHourRecords({ personId });
 *
 * Each method accepts an optional trailing `db` arg (a PrismaClient or a
 * transaction client) — see the `Db` type — defaulting to the shared singleton.
 */
export type { Db } from "./types";
export { ConflictError } from "./errors";

export * as hourRecordService from "./services/hourRecordService";
export * as contractService from "./services/contractService";
export * as declarationService from "./services/declarationService";
export * as personService from "./services/personService";
export * as squadService from "./services/squadService";
export * as clientService from "./services/clientService";
export * as componentMappingService from "./services/componentMappingService";
export * as nonBillableService from "./services/nonBillableService";
export * as anomalyService from "./services/anomalyService";
export * as syncService from "./services/syncService";
export * as reconciliationService from "./services/reconciliationService";
export * as analyticsRawService from "./services/analyticsRawService";
export * as reportsService from "./services/reportsService";
