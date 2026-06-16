import { describe, it, expect } from "vitest";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as contractService from "../contractService";
import { ConflictError } from "../../errors";

const oldSow = {
  id: 1,
  name: "SOW A",
  clientId: 7,
  contracts: [{ id: 11, name: "C1", hourType: "retainer" }],
};

const input = {
  startDate: new Date("2026-02-01"),
  endDate: null,
  contracts: [{ id: 11, assignedHours: 100 }],
};

describe("renewStatementOfWork", () => {
  it("creates a successor SOW and contract (linked to parents) and closes the old contracts", async () => {
    prismaMock.statementOfWork.findUnique
      .mockResolvedValueOnce(cast(oldSow))
      .mockResolvedValueOnce(cast({ id: 50, contracts: [] }));
    prismaMock.statementOfWork.create.mockResolvedValue(cast({ id: 50 }));
    prismaMock.contract.create.mockResolvedValue(cast({ id: 60 }));
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(cast([]));
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 });

    const result = await contractService.renewStatementOfWork(1, input);

    expect(result).toMatchObject({ id: 50 });
    expect(prismaMock.statementOfWork.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentSowId: 1, clientId: 7 }) })
    );
    expect(prismaMock.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentContractId: 11,
          sowId: 50,
          type: "base",
          status: "active",
          assignedHours: 100,
        }),
      })
    );
    expect(prismaMock.contract.updateMany).toHaveBeenCalledOnce();
  });

  it("re-points an old contract's open mapping to its successor at the renewal boundary", async () => {
    prismaMock.statementOfWork.findUnique
      .mockResolvedValueOnce(cast(oldSow))
      .mockResolvedValueOnce(cast({ id: 50, contracts: [] }));
    prismaMock.statementOfWork.create.mockResolvedValue(cast({ id: 50 }));
    prismaMock.contract.create.mockResolvedValue(cast({ id: 60 }));
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(
      cast([
        {
          id: 7,
          contractId: 11,
          componentKey: "X",
          jiraInstance: "na",
          effectiveFrom: new Date("2026-01-01"),
        },
      ])
    );
    prismaMock.jiraComponentClientMapping.create.mockResolvedValue(cast({ id: 8 }));
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 });

    await contractService.renewStatementOfWork(1, input);

    expect(prismaMock.jiraComponentClientMapping.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { effectiveTo: new Date("2026-01-31") },
    });
    expect(prismaMock.jiraComponentClientMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractId: 60, effectiveFrom: input.startDate }),
      })
    );
  });

  it("throws ConflictError when the SOW is not found", async () => {
    prismaMock.statementOfWork.findUnique.mockResolvedValueOnce(cast(null));

    await expect(contractService.renewStatementOfWork(1, input)).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(prismaMock.statementOfWork.create).not.toHaveBeenCalled();
  });

  it("throws ConflictError when a requested contract does not belong to the SOW", async () => {
    prismaMock.statementOfWork.findUnique.mockResolvedValueOnce(cast(oldSow));

    await expect(
      contractService.renewStatementOfWork(1, {
        ...input,
        contracts: [{ id: 99, assignedHours: 5 }],
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(prismaMock.statementOfWork.create).not.toHaveBeenCalled();
  });

  it("throws ConflictError when an open mapping starts on/after the renewal date", async () => {
    prismaMock.statementOfWork.findUnique.mockResolvedValueOnce(cast(oldSow));
    prismaMock.statementOfWork.create.mockResolvedValue(cast({ id: 50 }));
    prismaMock.contract.create.mockResolvedValue(cast({ id: 60 }));
    prismaMock.jiraComponentClientMapping.findMany.mockResolvedValue(
      cast([
        {
          id: 7,
          contractId: 11,
          componentKey: "X",
          jiraInstance: "na",
          effectiveFrom: new Date("2026-03-01"),
        },
      ])
    );

    await expect(contractService.renewStatementOfWork(1, input)).rejects.toBeInstanceOf(
      ConflictError
    );
  });
});

describe("archiveStatementOfWorkCascade", () => {
  it("closes contracts, end-dates mappings and deactivates the SOW", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.jiraComponentClientMapping.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.statementOfWork.update.mockResolvedValue(cast({ id: 3, isActive: false }));

    await contractService.archiveStatementOfWorkCascade(3);

    expect(prismaMock.contract.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.jiraComponentClientMapping.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.statementOfWork.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3 }, data: { isActive: false } })
    );
  });
});
