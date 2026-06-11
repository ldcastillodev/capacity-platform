// Shared contract health classification (overview "Contract Status Breakdown").
// NOTE: this taxonomy is intentionally separate from the /burn pace taxonomy,
// where "watch" means BELOW expected pace.

export type ContractHealthStatus = "critical" | "watch" | "on_track" | "underconsumption";

export const CRITICAL_THRESHOLD = 0.9; // ≥90% of pool consumed
export const WATCH_THRESHOLD = 0.7; // ≥70% of pool consumed
export const PACE_TOLERANCE = 0.1; // 10% relative grace below expected pace

/** Calendar-day fraction of [periodStart, periodEnd] elapsed as of `asOf`, clamped 0..1. */
export function expectedPaceFraction(periodStart: Date, periodEnd: Date, asOf: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return 1;
  const elapsed = asOf.getTime() - periodStart.getTime();
  return Math.min(Math.max(elapsed / total, 0), 1);
}

/**
 * Absolute thresholds first (critical > watch), then pace comparison.
 * `expectedPct: null` means no pace baseline (total contract without endDate)
 * — thresholds only, otherwise on track.
 */
export function classifyContractStatus(input: {
  consumedHours: number;
  poolHours: number;
  expectedPct: number | null;
}): ContractHealthStatus {
  const { consumedHours, poolHours, expectedPct } = input;
  if (poolHours <= 0) return consumedHours > 0 ? "watch" : "on_track";
  const pct = consumedHours / poolHours;
  if (pct >= CRITICAL_THRESHOLD) return "critical";
  if (pct >= WATCH_THRESHOLD) return "watch";
  if (expectedPct === null) return "on_track";
  if (consumedHours < poolHours * expectedPct * (1 - PACE_TOLERANCE)) return "underconsumption";
  return "on_track";
}
