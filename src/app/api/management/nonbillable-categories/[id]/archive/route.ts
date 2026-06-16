import { NextRequest, NextResponse } from "next/server";
import { nonBillableService } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await nonBillableService.archiveNonBillableCategory(Number(id));
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
