import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ flagId: string }> }) {
  const { flagId } = await params;
  const body = (await req.json()) as { resolution_notes?: string };

  const flag = await anomalyService.resolveAnomalyFlag(
    Number(flagId),
    body.resolution_notes ?? null
  );
  return NextResponse.json(flag);
}
