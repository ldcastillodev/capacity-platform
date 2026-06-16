import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";
import type { SuggestionStatus } from "@prisma/client";

const TERMINAL = ["applied", "dismissed"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const suggestion = await anomalyService.findSuggestionById(Number(id));
    if (!suggestion) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (TERMINAL.includes(suggestion.status))
      return NextResponse.json({ error: "Suggestion is in a terminal state." }, { status: 400 });

    const body = (await req.json()) as { status: string; resolved_by?: number };
    const allowed = ["acknowledged", "applied", "dismissed"];
    if (!allowed.includes(body.status))
      return NextResponse.json(
        { error: `Status must be one of: ${allowed.join(", ")}.` },
        { status: 400 }
      );

    const row = await anomalyService.updateManagedSuggestionStatus(Number(id), {
      status: body.status as SuggestionStatus,
      ...(TERMINAL.includes(body.status) && {
        resolvedAt: new Date(),
        resolvedBy: body.resolved_by ?? null,
      }),
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
