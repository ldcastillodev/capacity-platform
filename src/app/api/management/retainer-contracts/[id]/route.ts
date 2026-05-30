import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const contract = await prisma.retainerContract.findUnique({ where: { id: Number(id) } });
    if (!contract) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (contract.status === "closed")
      return NextResponse.json({ error: "Contract is closed and cannot be edited." }, { status: 400 });

    const body = await req.json() as { total_pool_hours?: number; valid_to?: string | null };
    const row = await prisma.retainerContract.update({
      where: { id: Number(id) },
      data: {
        ...(body.total_pool_hours !== undefined && { totalPoolHours: body.total_pool_hours }),
        ...(body.valid_to !== undefined && {
          validTo: body.valid_to ? new Date(body.valid_to) : null,
        }),
      },
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
