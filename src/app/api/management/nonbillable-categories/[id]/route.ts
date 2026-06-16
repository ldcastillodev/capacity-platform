import { NextRequest, NextResponse } from "next/server";
import { nonBillableService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      name?: string;
      description?: string | null;
      type?: string;
    };
    const row = await nonBillableService.updateNonBillableCategory(Number(id), {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.type !== undefined && { type: body.type as never }),
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
