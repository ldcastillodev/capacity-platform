import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sowId = searchParams.get("sowId");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const contracts = await prisma.contract.findMany({
    where: {
      ...(sowId ? { sowId: Number(sowId) } : {}),
      ...(includeArchived ? {} : { status: { not: "closed" } }),
    },
    orderBy: [{ sowId: "asc" }, { startDate: "asc" }],
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
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    sow_id: number;
    hour_type: "monthly" | "total";
    type: "base" | "change_order";
    assigned_hours: number;
    start_date: string;
    end_date?: string;
    status?: "active" | "paused" | "closed";
  };

  const contract = await prisma.contract.create({
    data: {
      name: body.name,
      sowId: body.sow_id,
      hourType: body.hour_type,
      type: body.type,
      assignedHours: body.assigned_hours,
      startDate: new Date(body.start_date),
      endDate: body.end_date ? new Date(body.end_date) : null,
      status: body.status ?? "active",
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
  return NextResponse.json(contract, { status: 201 });
}
