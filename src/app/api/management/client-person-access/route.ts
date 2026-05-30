import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.clientPersonAccess.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(personId ? { personId: Number(personId) } : {}),
      },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true, clientId: true, personId: true,
        grantedAt: true, grantedBy: true, revokedAt: true,
        client: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { client_id: number; person_id: number; granted_by?: number };
    const row = await prisma.clientPersonAccess.create({
      data: {
        clientId: body.client_id,
        personId: body.person_id,
        grantedBy: body.granted_by ?? null,
      },
      select: {
        id: true, clientId: true, personId: true,
        grantedAt: true, grantedBy: true, revokedAt: true,
        client: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
