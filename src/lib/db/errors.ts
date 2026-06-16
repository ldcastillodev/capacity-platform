/**
 * Domain errors thrown by the service layer. Routes catch these and map them to
 * HTTP status codes (e.g. `ConflictError` → 409). Lives here — not in route
 * files — so the transaction methods that raise them and the routes that handle
 * them reference the same class for `instanceof` checks.
 */

/** A temporal/uniqueness conflict (overlapping effective ranges, etc.) → 409. */
export class ConflictError extends Error {}
