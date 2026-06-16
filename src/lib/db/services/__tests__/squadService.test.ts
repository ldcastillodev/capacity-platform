import { describe, it, expect } from "vitest";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as squadService from "../squadService";
import { ConflictError } from "../../errors";

const input = {
  personId: 1,
  squadId: 10,
  allocationPct: 1.0,
  effectiveFrom: new Date("2026-02-01"),
};

describe("createMembershipWithOverlapResolution", () => {
  it("creates the membership when the person has no open memberships", async () => {
    prismaMock.squadMembership.findMany.mockResolvedValue(cast([]));
    prismaMock.squadMembership.create.mockResolvedValue(cast({ id: 50 }));

    const result = await squadService.createMembershipWithOverlapResolution(input);

    expect(result).toMatchObject({ id: 50 });
    expect(prismaMock.squadMembership.update).not.toHaveBeenCalled();
  });

  it("closes a prior membership in the same squad before creating the new one", async () => {
    prismaMock.squadMembership.findMany.mockResolvedValue(
      cast([{ id: 9, squadId: 10, effectiveFrom: new Date("2026-01-01") }])
    );
    prismaMock.squadMembership.create.mockResolvedValue(cast({ id: 50 }));

    await squadService.createMembershipWithOverlapResolution(input);

    expect(prismaMock.squadMembership.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { effectiveTo: new Date("2026-01-31") },
    });
  });

  it("leaves a partial-allocation membership in another squad open (intentional split)", async () => {
    prismaMock.squadMembership.findMany.mockResolvedValue(
      cast([{ id: 9, squadId: 99, effectiveFrom: new Date("2026-01-01") }])
    );
    prismaMock.squadMembership.create.mockResolvedValue(cast({ id: 50 }));

    await squadService.createMembershipWithOverlapResolution({ ...input, allocationPct: 0.5 });

    expect(prismaMock.squadMembership.update).not.toHaveBeenCalled();
    expect(prismaMock.squadMembership.create).toHaveBeenCalledOnce();
  });

  it("throws ConflictError and creates nothing when a prior membership starts on/after the new date", async () => {
    prismaMock.squadMembership.findMany.mockResolvedValue(
      cast([{ id: 9, squadId: 10, effectiveFrom: new Date("2026-03-01") }])
    );

    await expect(squadService.createMembershipWithOverlapResolution(input)).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(prismaMock.squadMembership.create).not.toHaveBeenCalled();
  });
});

describe("archiveSquadCascade", () => {
  it("ends open memberships and deactivates the squad", async () => {
    prismaMock.squadMembership.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.squad.update.mockResolvedValue(cast({ id: 7, isActive: false }));

    await squadService.archiveSquadCascade(7);

    expect(prismaMock.squadMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { squadId: 7, effectiveTo: null } })
    );
    expect(prismaMock.squad.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: { isActive: false } })
    );
  });

  it("propagates (rolls back) when ending memberships fails", async () => {
    prismaMock.squadMembership.updateMany.mockRejectedValue(new Error("db down"));

    await expect(squadService.archiveSquadCascade(7)).rejects.toThrow("db down");
    expect(prismaMock.squad.update).not.toHaveBeenCalled();
  });
});
