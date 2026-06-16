import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    start_date?: string;
    end_date?: string | null;
  };

  const sow = await contractService.updateStatementOfWork(Number(id), {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.start_date !== undefined && { startDate: new Date(body.start_date) }),
    ...(body.end_date !== undefined && {
      endDate: body.end_date ? new Date(body.end_date) : null,
    }),
  });
  return NextResponse.json(sow);
}
