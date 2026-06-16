import { describe, it, expect } from "vitest";
import { prismaMock, cast } from "../../__tests__/prismaSingleton";
import * as clientService from "../clientService";

describe("archiveClientCascade", () => {
  it("closes contracts and end-dates mappings under every SOW, then deactivates the client", async () => {
    prismaMock.statementOfWork.findMany.mockResolvedValue(cast([{ id: 1 }, { id: 2 }]));
    prismaMock.contract.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.jiraComponentClientMapping.updateMany.mockResolvedValue({ count: 4 });
    prismaMock.client.update.mockResolvedValue(cast({ id: 5, isActive: false }));

    await clientService.archiveClientCascade(5);

    expect(prismaMock.contract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sowId: { in: [1, 2] } }) })
    );
    expect(prismaMock.jiraComponentClientMapping.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { isActive: false } })
    );
  });

  it("skips the cascade when the client has no SOWs but still deactivates it", async () => {
    prismaMock.statementOfWork.findMany.mockResolvedValue(cast([]));
    prismaMock.client.update.mockResolvedValue(cast({ id: 5, isActive: false }));

    await clientService.archiveClientCascade(5);

    expect(prismaMock.contract.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.jiraComponentClientMapping.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.client.update).toHaveBeenCalledOnce();
  });

  it("propagates (rolls back) when closing contracts fails", async () => {
    prismaMock.statementOfWork.findMany.mockResolvedValue(cast([{ id: 1 }]));
    prismaMock.contract.updateMany.mockRejectedValue(new Error("db down"));

    await expect(clientService.archiveClientCascade(5)).rejects.toThrow("db down");
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });
});
