import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const flag = await anomalyService.findAnomalyFlagById(Number(id));
    if (!flag) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (flag.resolvedAt)
      return NextResponse.json({ error: "Flag is already resolved." }, { status: 400 });

    const body = (await req.json()) as { resolved_by: number; resolution_notes: string };
    if (!body.resolution_notes)
      return NextResponse.json({ error: "resolution_notes is required." }, { status: 400 });

    const row = await anomalyService.resolveAnomalyFlagWithUser(
      Number(id),
      body.resolved_by ?? null,
      body.resolution_notes
    );
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
