import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * A Prisma client capable of executing queries — either the shared singleton
 * or a transaction client handed in by a `prisma.$transaction(...)` callback.
 *
 * Every service method accepts this as an optional final parameter (defaulting
 * to the singleton) so callers inside a transaction can route the query through
 * their `tx` handle without the method having to know about the transaction.
 */
export type Db = PrismaClient | Prisma.TransactionClient;
