import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ squadId: string }> },
) {
  const { squadId } = await params;
  const squad = await prisma.squad.findUnique({
    where: { id: Number(squadId) },
    select: { id: true, name: true, leadPersonId: true },
  });
  if (!squad) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(squad);
}
