import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

// BR-7: renewal creates a NEW SOW (linked via parentSowId) with new child
// contracts (linked via parentContractId) and re-pointed component mappings.
// The old SOW is preserved as a historical record; its contracts are closed
// and their open mappings end-dated at the renewal boundary, so backdated
// worklogs still route to the old contracts and new worklogs to the new ones.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const oldSowId = Number(id);

  const body = await req.json() as {
    name?: string;
    start_date: string;
    end_date?: string;
    contracts: Array<{ id: number; assigned_hours: number }>;
  };

  if (!body.start_date || !Array.isArray(body.contracts)) {
    return NextResponse.json(
      { error: "start_date and contracts are required." },
      { status: 400 },
    );
  }

  const startDate = toUtcDateOnly(body.start_date);
  const mappingEnd = addUtcDays(startDate, -1);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const oldSow = await tx.statementOfWork.findUnique({
        where: { id: oldSowId },
        include: { contracts: { select: { id: true, name: true, hourType: true } } },
      });
      if (!oldSow) throw new ConflictError("Statement of work not found.");

      const oldContractById = new Map(oldSow.contracts.map(c => [c.id, c]));
      for (const c of body.contracts) {
        if (!oldContractById.has(c.id)) {
          throw new ConflictError(`Contract ${c.id} does not belong to this statement of work.`);
        }
      }

      const newSow = await tx.statementOfWork.create({
        data: {
          name: body.name ?? oldSow.name,
          clientId: oldSow.clientId,
          startDate,
          endDate: body.end_date ? toUtcDateOnly(body.end_date) : null,
          parentSowId: oldSow.id,
        },
      });

      // Successor contracts for the carried-forward ones.
      const successorByOldId = new Map<number, number>();
      for (const c of body.contracts) {
        const old = oldContractById.get(c.id)!;
        const successor = await tx.contract.create({
          data: {
            name: old.name,
            sowId: newSow.id,
            hourType: old.hourType,
            type: "base",
            assignedHours: c.assigned_hours,
            startDate,
            endDate: body.end_date ? toUtcDateOnly(body.end_date) : null,
            status: "active",
            parentContractId: old.id,
          },
        });
        successorByOldId.set(old.id, successor.id);
      }

      // Split mappings at the renewal boundary: end-date open mappings of all
      // old contracts; re-create them against the successor where one exists.
      const oldContractIds = oldSow.contracts.map(c => c.id);
      const openMappings = await tx.jiraComponentClientMapping.findMany({
        where: { contractId: { in: oldContractIds }, effectiveTo: null },
      });
      for (const m of openMappings) {
        if (m.effectiveFrom >= startDate) {
          throw new ConflictError(
            `Mapping for component "${m.componentKey}" starts on/after the renewal date; adjust it first.`,
          );
        }
        await tx.jiraComponentClientMapping.update({
          where: { id: m.id },
          data: { effectiveTo: mappingEnd },
        });
        const successorId = successorByOldId.get(m.contractId);
        if (successorId !== undefined) {
          await tx.jiraComponentClientMapping.create({
            data: {
              jiraInstance: m.jiraInstance,
              componentKey: m.componentKey,
              contractId: successorId,
              effectiveFrom: startDate,
            },
          });
        }
      }

      await tx.contract.updateMany({
        where: { id: { in: oldContractIds }, status: { not: "closed" } },
        data: { status: "closed" },
      });

      return tx.statementOfWork.findUnique({
        where: { id: newSow.id },
        include: {
          contracts: { select: { id: true, name: true, assignedHours: true, parentContractId: true } },
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
