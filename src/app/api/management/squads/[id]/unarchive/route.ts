import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const squad = await squadService.setSquadActive(Number(id), true);

  return NextResponse.json(squad);
}
