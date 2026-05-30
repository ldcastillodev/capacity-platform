import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const includeArchived = searchParams.get("includeArchived") === "true";
  try {
    const now = new Date();
    const rows = await prisma.tempoAccountClientMapping.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(includeArchived ? {} : {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        }),
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, accountKey: true, clientId: true, effectiveFrom: true, effectiveTo: true,
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
      account_key: string; client_id: number; effective_from: string; effective_to?: string;
    };
    const row = await prisma.tempoAccountClientMapping.create({
      data: {
        accountKey: body.account_key,
        clientId: body.client_id,
        effectiveFrom: new Date(body.effective_from),
        effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
      },
      select: {
        id: true, accountKey: true, clientId: true, effectiveFrom: true, effectiveTo: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Mapping already exists for this account key and date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
