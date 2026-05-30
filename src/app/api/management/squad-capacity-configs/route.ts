import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squadId");
  try {
    const rows = await prisma.squadCapacityConfig.findMany({
      where: squadId ? { squadId: Number(squadId) } : undefined,
      orderBy: { roleType: "asc" },
      select: {
        id: true, squadId: true, roleType: true,
        hardBufferPct: true, softBufferPct: true,
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      squad_id: number; role_type: string;
      hard_buffer_pct?: number; soft_buffer_pct?: number;
    };
    const row = await prisma.squadCapacityConfig.create({
      data: {
        squadId: body.squad_id,
        roleType: body.role_type as never,
        hardBufferPct: body.hard_buffer_pct ?? 0.15,
        softBufferPct: body.soft_buffer_pct ?? 0.10,
      },
      select: {
        id: true, squadId: true, roleType: true,
        hardBufferPct: true, softBufferPct: true,
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Config already exists for this squad/role." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
