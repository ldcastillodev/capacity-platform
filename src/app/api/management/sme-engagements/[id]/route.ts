import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sme = await prisma.sMEEngagement.findUnique({ where: { id: Number(id) } });
    if (!sme) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (sme.status === "closed")
      return NextResponse.json({ error: "Closed engagements cannot be edited." }, { status: 400 });

    const body = await req.json() as {
      person_id?: number | null; contracted_hours?: number;
      cost_rate?: number; billing_rate?: number;
    };
    const row = await prisma.sMEEngagement.update({
      where: { id: Number(id) },
      data: {
        ...(body.person_id !== undefined && { personId: body.person_id }),
        ...(body.contracted_hours !== undefined && { contractedHours: body.contracted_hours }),
        ...(body.cost_rate !== undefined && { costRate: body.cost_rate }),
        ...(body.billing_rate !== undefined && { billingRate: body.billing_rate }),
      },
      select: {
        id: true, clientId: true, squadId: true, month: true,
        roleDescription: true, source: true, personId: true,
        contractedHours: true, costRate: true, billingRate: true,
        currency: true, status: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
