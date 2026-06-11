// Shared date-effective lookup helpers.
// effectiveFrom/effectiveTo columns are @db.Date; effectiveTo is inclusive (null = open-ended).

/** Normalize a timestamp to a UTC date-only Date (midnight UTC). */
export function toUtcDateOnly(ts: string | Date): Date {
  const d = new Date(ts);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Add (or subtract) whole days to a UTC date-only Date. */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Find the row whose [effectiveFrom, effectiveTo] range contains `date`.
 * Pass rows ordered by effectiveFrom desc so the most recent matching row wins
 * when overlapping rows exist.
 */
export function findEffective<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  rows: T[],
  date: Date,
): T | undefined {
  return rows.find(
    r => r.effectiveFrom <= date && (r.effectiveTo === null || r.effectiveTo >= date),
  );
}
