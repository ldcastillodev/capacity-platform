import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await prisma.tEBillingRoleRate.findMany({
      where: { teBillingConfigId: Number(id) },
      orderBy: { roleType: "asc" },
      select: { id: true, teBillingConfigId: true, roleType: true, ratePerHour: true, currency: true },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { role_type: string; rate_per_hour: number; currency: string };
    const row = await prisma.tEBillingRoleRate.create({
      data: {
        teBillingConfigId: Number(id),
        roleType: body.role_type as never,
        ratePerHour: body.rate_per_hour,
        currency: body.currency as never,
      },
      select: { id: true, teBillingConfigId: true, roleType: true, ratePerHour: true, currency: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Rate already exists for this role." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
