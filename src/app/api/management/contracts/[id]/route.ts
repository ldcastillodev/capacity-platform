import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    hour_type?: "monthly" | "total";
    type?: "base" | "change_order" | "extension";
    assigned_hours?: number;
    start_date?: string;
    end_date?: string | null;
    status?: "active" | "paused" | "closed";
  };

  const contract = await prisma.contract.update({
    where: { id: Number(id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.hour_type !== undefined && { hourType: body.hour_type }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.assigned_hours !== undefined && { assignedHours: body.assigned_hours }),
      ...(body.start_date !== undefined && { startDate: new Date(body.start_date) }),
      ...(body.end_date !== undefined && { endDate: body.end_date ? new Date(body.end_date) : null }),
      ...(body.status !== undefined && { status: body.status }),
    },
    select: {
      id: true,
      name: true,
      sowId: true,
      hourType: true,
      type: true,
      assignedHours: true,
      startDate: true,
      endDate: true,
      status: true,
      sow: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json(contract);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contractId = Number(id);

  const declarationCount = await prisma.monthlyRoleDeclaration.count({ where: { contractId } });

  if (declarationCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a contract that has declarations." },
      { status: 400 },
    );
  }

  // BR-8: the HourRecord FK is onDelete: SetNull — deleting a contract would
  // silently strip contractId from the historical ledger. Refuse instead.
  const hourCount = await prisma.hourRecord.count({ where: { contractId } });
  if (hourCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${hourCount} hour record(s) are attributed to this contract. Close it instead.` },
      { status: 409 },
    );
  }

  await prisma.contract.delete({ where: { id: contractId } });
  return NextResponse.json({ success: true });
}
