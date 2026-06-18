// Shared display/parse formatters. Pure functions — safe on server and client.

/** Format a number of hours for display, e.g. 7.5 -> "7.5h". */
export function formatHours(n: number): string {
  return `${n.toFixed(1)}h`;
}

/**
 * Format a value as a whole-number percent, e.g. 42 -> "42%".
 * Pass `{ fromFraction: true }` when the input is a 0–1 fraction (0.42 -> "42%").
 */
export function formatPercent(value: number, opts?: { fromFraction?: boolean }): string {
  const pct = opts?.fromFraction ? value * 100 : value;
  return `${pct.toFixed(0)}%`;
}

/** Coerce a Prisma aggregate decimal (Decimal | null | string) to a float, defaulting null to 0. */
export function parseHours(value: unknown): number {
  return parseFloat(String(value ?? 0));
}
