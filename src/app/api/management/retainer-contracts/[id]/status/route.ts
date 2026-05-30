import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const TRANSITIONS: Record<string, string[]> = {
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { status: string };
    const contract = await prisma.retainerContract.findUnique({ where: { id: Number(id) } });
    if (!contract) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const allowed = TRANSITIONS[contract.status] ?? [];
    if (!allowed.includes(body.status))
      return NextResponse.json(
        { error: `Cannot transition from ${contract.status} to ${body.status}.` },
        { status: 400 },
      );

    const row = await prisma.retainerContract.update({
      where: { id: Number(id) },
      data: { status: body.status as never },
      select: {
        id: true, clientId: true, squadId: true,
        totalPoolHours: true, status: true, validFrom: true, validTo: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { declarations: true, amendments: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
