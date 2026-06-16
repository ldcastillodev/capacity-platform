import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    hour_type?: "monthly" | "total";
    type?: "base" | "change_order" | "extension";
    assigned_hours?: number;
    start_date?: string;
    end_date?: string | null;
    status?: "active" | "paused" | "closed";
  };

  const contract = await contractService.updateContract(Number(id), {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.hour_type !== undefined && { hourType: body.hour_type }),
    ...(body.type !== undefined && { type: body.type }),
    ...(body.assigned_hours !== undefined && { assignedHours: body.assigned_hours }),
    ...(body.start_date !== undefined && { startDate: new Date(body.start_date) }),
    ...(body.end_date !== undefined && {
      endDate: body.end_date ? new Date(body.end_date) : null,
    }),
    ...(body.status !== undefined && { status: body.status }),
  });
  return NextResponse.json(contract);
}
