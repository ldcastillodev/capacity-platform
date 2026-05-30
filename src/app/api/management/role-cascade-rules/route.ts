import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  try {
    const rows = await prisma.roleCascadeRule.findMany({
      where: clientId ? { clientId: Number(clientId) } : undefined,
      orderBy: [{ triggerRole: "asc" }, { dependentRole: "asc" }],
      select: {
        id: true, clientId: true, triggerRole: true, dependentRole: true, ratio: true,
        client: { select: { id: true, name: true } },
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
      client_id?: number; trigger_role: string; dependent_role: string; ratio: number;
    };
    const row = await prisma.roleCascadeRule.create({
      data: {
        clientId: body.client_id ?? null,
        triggerRole: body.trigger_role as never,
        dependentRole: body.dependent_role as never,
        ratio: body.ratio,
      },
      select: {
        id: true, clientId: true, triggerRole: true, dependentRole: true, ratio: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Rule already exists for this client/trigger/dependent role." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
