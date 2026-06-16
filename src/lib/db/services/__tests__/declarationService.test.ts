import { describe, it, expect } from "vitest";
import type { RoleType } from "@prisma/client";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as declarationService from "../declarationService";

const roles: Array<{ roleType: RoleType; declaredHours: number }> = [
  { roleType: "dev" as RoleType, declaredHours: 10 },
  { roleType: "qa" as RoleType, declaredHours: 5 },
];

describe("upsertDeclarationRoles", () => {
  it("upserts every role's PLANNED hours by (declaration, role)", async () => {
    prismaMock.declarationRoleEntry.upsert.mockResolvedValue(cast({ id: 1 }));

    await declarationService.upsertDeclarationRoles(42, roles);

    expect(prismaMock.declarationRoleEntry.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.declarationRoleEntry.upsert).toHaveBeenNthCalledWith(1, {
      where: { declarationId_roleType: { declarationId: 42, roleType: "dev" } },
      update: { declaredHours: 10 },
      create: { declarationId: 42, roleType: "dev", declaredHours: 10 },
    });
  });

  it("does nothing for an empty role list", async () => {
    await declarationService.upsertDeclarationRoles(42, []);
    expect(prismaMock.declarationRoleEntry.upsert).not.toHaveBeenCalled();
  });

  it("propagates (rolls back) when an upsert fails partway", async () => {
    prismaMock.declarationRoleEntry.upsert
      .mockResolvedValueOnce(cast({ id: 1 }))
      .mockRejectedValueOnce(new Error("db down"));

    await expect(declarationService.upsertDeclarationRoles(42, roles)).rejects.toThrow("db down");
  });
});
