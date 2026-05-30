import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const TERMINAL = ["applied", "dismissed"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const suggestion = await prisma.nonBillableEnhancementSuggestion.findUnique({ where: { id: Number(id) } });
    if (!suggestion) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (TERMINAL.includes(suggestion.status))
      return NextResponse.json({ error: "Suggestion is in a terminal state." }, { status: 400 });

    const body = await req.json() as { status: string; resolved_by?: number };
    const allowed = ["acknowledged", "applied", "dismissed"];
    if (!allowed.includes(body.status))
      return NextResponse.json({ error: `Status must be one of: ${allowed.join(", ")}.` }, { status: 400 });

    const row = await prisma.nonBillableEnhancementSuggestion.update({
      where: { id: Number(id) },
      data: {
        status: body.status as never,
        ...(TERMINAL.includes(body.status) && {
          resolvedAt: new Date(),
          resolvedBy: body.resolved_by ?? null,
        }),
      },
      select: { id: true, status: true, resolvedAt: true, resolvedBy: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
