import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const access = await prisma.clientPersonAccess.findUnique({ where: { id: Number(id) } });
    if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (access.revokedAt)
      return NextResponse.json({ error: "Access is already revoked." }, { status: 400 });

    const row = await prisma.clientPersonAccess.update({
      where: { id: Number(id) },
      data: { revokedAt: new Date() },
      select: {
        id: true, clientId: true, personId: true,
        grantedAt: true, revokedAt: true,
        client: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
