import { describe, it, expect } from "vitest";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as componentMappingService from "../componentMappingService";
import { ConflictError } from "../../errors";

const input = {
  jiraInstance: "na",
  componentKey: "COMP",
  contractId: 20,
  effectiveFrom: new Date("2026-02-01"),
};

describe("createMappingWithOverlapResolution", () => {
  it("creates the mapping when no prior open mapping exists", async () => {
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(cast([]));
    prismaMock.jiraComponentClientMapping.create.mockResolvedValue(cast({ id: 99 }));

    const result = await componentMappingService.createMappingWithOverlapResolution(input);

    expect(result).toMatchObject({ id: 99 });
    expect(prismaMock.jiraComponentClientMapping.update).not.toHaveBeenCalled();
    expect(prismaMock.jiraComponentClientMapping.create).toHaveBeenCalledOnce();
  });

  it("end-dates a prior open mapping at the day before, then creates the new one", async () => {
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(
      cast([{ id: 5, effectiveFrom: new Date("2026-01-01") }])
    );
    prismaMock.jiraComponentClientMapping.create.mockResolvedValue(cast({ id: 99 }));

    await componentMappingService.createMappingWithOverlapResolution(input);

    expect(prismaMock.jiraComponentClientMapping.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { effectiveTo: new Date("2026-01-31") },
    });
    expect(prismaMock.jiraComponentClientMapping.create).toHaveBeenCalledOnce();
  });

  it("throws ConflictError and creates nothing when a prior mapping starts on/after the new date", async () => {
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(
      cast([{ id: 5, effectiveFrom: new Date("2026-03-01") }])
    );

    await expect(
      componentMappingService.createMappingWithOverlapResolution(input)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(prismaMock.jiraComponentClientMapping.create).not.toHaveBeenCalled();
  });
});

describe("createManagedMappingWithOverlapResolution", () => {
  it("returns the management shape after closing the prior mapping", async () => {
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(cast([]));
    prismaMock.jiraComponentClientMapping.create.mockResolvedValue(
      cast({ id: 7, contract: { id: 20, name: "C" } })
    );

    const result = await componentMappingService.createManagedMappingWithOverlapResolution(input);

    expect(result).toMatchObject({ id: 7 });
    expect(prismaMock.jiraComponentClientMapping.create).toHaveBeenCalledOnce();
  });
});
