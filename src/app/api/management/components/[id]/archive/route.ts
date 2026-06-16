import { NextRequest, NextResponse } from "next/server";
import { componentMappingService } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await componentMappingService.endDateComponentMapping(Number(id), today);

  return NextResponse.json({ success: true });
}
