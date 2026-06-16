import { contractService, componentMappingService } from "./db";
import { toUtcDateOnly } from "./temporal";

/**
 * BR-6: when a contract's own endDate or its SOW's endDate has passed,
 * close the contract and end-date its open component mappings so worklogs
 * stop routing to it. Idempotent — already-closed rows are untouched.
 * Runs at the start of every sync and via /api/admin/jobs/expiry-sweep
 * (intended for a nightly Cloud Scheduler trigger).
 */
export async function runExpirySweep(): Promise<{
  contractsClosed: number;
  mappingsEnded: number;
}> {
  const today = toUtcDateOnly(new Date());

  const closed = await contractService.closeExpiredContracts(today);

  // effectiveFrom <= today guard: a future-dated mapping cannot be end-dated
  // before it starts (effectiveTo is inclusive and must be >= effectiveFrom).
  const ended = await componentMappingService.endOpenMappingsForClosedContracts(today);

  return { contractsClosed: closed.count, mappingsEnded: ended.count };
}
