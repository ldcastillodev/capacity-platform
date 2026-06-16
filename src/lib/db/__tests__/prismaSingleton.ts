import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

// Replace the shared Prisma singleton with one deep mock instance, exposed as
// `prismaMock` for tests to program and assert against. Both the default and the
// named export point at the same mock so either import style is intercepted.
vi.mock("@/lib/prisma", () => {
  const mock = mockDeep<PrismaClient>();
  return { __esModule: true, default: mock, prisma: mock };
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

/**
 * Cast a hand-built fixture to whatever type the call site expects (e.g. a
 * Prisma mock's `mockResolvedValue` argument). Lets tests supply only the fields
 * the code under test actually reads, without `any`.
 */
export function cast<T>(value: unknown): T {
  return value as T;
}

/** The callback overload of `$transaction`, narrowed for the mock impl. */
type TxCallback = <T>(fn: (tx: DeepMockProxy<PrismaClient>) => Promise<T>) => Promise<T>;

beforeEach(() => {
  mockReset(prismaMock);
  // Service transaction methods use the interactive-callback overload; run the
  // callback synchronously against the mock so its body executes and any thrown
  // error propagates (a rejected transaction), mirroring real rollback.
  (
    prismaMock.$transaction as unknown as { mockImplementation(fn: TxCallback): void }
  ).mockImplementation((fn) => fn(prismaMock));
});
