import { NextRequest, NextResponse } from "next/server";
import { personService } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await personService.archivePersonCascade(Number(id));
  return NextResponse.json({ success: true });
}
