import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ squadId: string }> }) {
  const { squadId } = await params;
  const squad = await squadService.findSquadBasic(Number(squadId));
  if (!squad) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(squad);
}
