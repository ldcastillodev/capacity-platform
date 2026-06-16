import { describe, it, expect } from "vitest";
import type { RoleType } from "@prisma/client";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as personService from "../personService";
import { ConflictError } from "../../errors";

const roleInput = {
  personId: 1,
  roleType: "dev" as RoleType,
  seniority: null,
  effectiveFrom: new Date("2026-02-01"),
};

describe("createManagedPersonRoleWithOverlapResolution", () => {
  it("creates the role when the person has no open role", async () => {
    prismaMock.personRole.findMany.mockResolvedValue(cast([]));
    prismaMock.personRole.create.mockResolvedValue(cast({ id: 1, person: { id: 1, name: "A" } }));

    const result = await personService.createManagedPersonRoleWithOverlapResolution(roleInput);

    expect(result).toMatchObject({ id: 1 });
    expect(prismaMock.personRole.update).not.toHaveBeenCalled();
  });

  it("end-dates an overlapping open role before creating the new one", async () => {
    prismaMock.personRole.findMany.mockResolvedValue(
      cast([{ id: 5, effectiveFrom: new Date("2026-01-01") }])
    );
    prismaMock.personRole.create.mockResolvedValue(cast({ id: 1 }));

    await personService.createManagedPersonRoleWithOverlapResolution(roleInput);

    expect(prismaMock.personRole.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { effectiveTo: new Date("2026-01-31") },
    });
  });

  it("throws ConflictError and creates nothing when an open role starts on/after the new date", async () => {
    prismaMock.personRole.findMany.mockResolvedValue(
      cast([{ id: 5, effectiveFrom: new Date("2026-03-01") }])
    );

    await expect(
      personService.createManagedPersonRoleWithOverlapResolution(roleInput)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(prismaMock.personRole.create).not.toHaveBeenCalled();
  });
});

describe("createPersonRoleWithOverlapResolution", () => {
  it("honours an explicit effectiveTo on the created role", async () => {
    prismaMock.personRole.findMany.mockResolvedValue(cast([]));
    prismaMock.personRole.create.mockResolvedValue(cast({ id: 2 }));

    await personService.createPersonRoleWithOverlapResolution({
      ...roleInput,
      effectiveTo: new Date("2026-12-31"),
    });

    expect(prismaMock.personRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ effectiveTo: new Date("2026-12-31") }),
      })
    );
  });
});

describe("createPersonWithOptionalMembership", () => {
  it("creates the person and an initial membership when a squad is given", async () => {
    prismaMock.person.create.mockResolvedValue(cast({ id: 3 }));
    prismaMock.squadMembership.create.mockResolvedValue(cast({ id: 4 }));
    prismaMock.person.findUnique.mockResolvedValue(cast({ id: 3, squadMemberships: [] }));

    const result = await personService.createPersonWithOptionalMembership({
      name: "A",
      email: "a@x.io",
      squadId: 9,
    });

    expect(result).toMatchObject({ id: 3 });
    expect(prismaMock.squadMembership.create).toHaveBeenCalledOnce();
  });

  it("creates only the person when no squad is given", async () => {
    prismaMock.person.create.mockResolvedValue(cast({ id: 3 }));
    prismaMock.person.findUnique.mockResolvedValue(cast({ id: 3, squadMemberships: [] }));

    await personService.createPersonWithOptionalMembership({ name: "A", email: "a@x.io" });

    expect(prismaMock.squadMembership.create).not.toHaveBeenCalled();
  });
});

describe("updatePersonWithCapacityHistory", () => {
  it("opens a new capacity history row when capacity changes and none is open", async () => {
    prismaMock.person.update.mockResolvedValue(cast({ id: 1, weeklyCapacityHours: 32 }));
    prismaMock.personCapacityHistory.findFirst.mockResolvedValue(cast(null));
    prismaMock.personCapacityHistory.create.mockResolvedValue(cast({ id: 7 }));

    const result = await personService.updatePersonWithCapacityHistory(1, {
      weeklyCapacityHours: 32,
    });

    expect(result).toMatchObject({ id: 1 });
    expect(prismaMock.personCapacityHistory.create).toHaveBeenCalledOnce();
  });

  it("does not touch capacity history when capacity is not provided", async () => {
    prismaMock.person.update.mockResolvedValue(cast({ id: 1 }));

    await personService.updatePersonWithCapacityHistory(1, { name: "New" });

    expect(prismaMock.personCapacityHistory.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.personCapacityHistory.create).not.toHaveBeenCalled();
  });
});

describe("updatePersonWithCapacityAndMembership", () => {
  it("closes a past membership and starts a new one on a squad transition", async () => {
    prismaMock.person.update.mockResolvedValue(cast({ id: 1 }));
    prismaMock.squadMembership.findMany.mockResolvedValue(
      cast([{ id: 9, squadId: 2, effectiveFrom: new Date("2020-01-01") }])
    );
    prismaMock.squadMembership.update.mockResolvedValue(cast({ id: 9 }));
    prismaMock.squadMembership.create.mockResolvedValue(cast({ id: 10 }));
    prismaMock.person.findUnique.mockResolvedValue(cast({ id: 1, squadMemberships: [] }));

    await personService.updatePersonWithCapacityAndMembership(1, { squadId: 3 });

    expect(prismaMock.squadMembership.update).toHaveBeenCalledOnce();
    expect(prismaMock.squadMembership.create).toHaveBeenCalledOnce();
  });

  it("throws ConflictError when an existing membership already starts today or later", async () => {
    prismaMock.person.update.mockResolvedValue(cast({ id: 1 }));
    prismaMock.squadMembership.findMany.mockResolvedValue(
      cast([{ id: 9, squadId: 2, effectiveFrom: new Date("2999-01-01") }])
    );

    await expect(
      personService.updatePersonWithCapacityAndMembership(1, { squadId: 3 })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(prismaMock.squadMembership.create).not.toHaveBeenCalled();
  });
});

describe("archivePersonCascade", () => {
  it("ends memberships, clears lead references and deactivates the person", async () => {
    prismaMock.squadMembership.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.squad.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.person.update.mockResolvedValue(cast({ id: 1, isActive: false }));

    await personService.archivePersonCascade(1);

    expect(prismaMock.squadMembership.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.squad.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadPersonId: 1 } })
    );
    expect(prismaMock.person.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { isActive: false } })
    );
  });
});
