import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.personRole.findMany({
      where: personId ? { personId: Number(personId) } : undefined,
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, personId: true, roleType: true,
        seniority: true, isPrimary: true, effectiveFrom: true, effectiveTo: true,
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
    const body = await req.json() as {
      person_id: number; role_type: string; seniority?: string;
      is_primary?: boolean; effective_from: string;
    };
    const row = await prisma.personRole.create({
      data: {
        personId: body.person_id,
        roleType: body.role_type as never,
        seniority: body.seniority as never ?? null,
        isPrimary: body.is_primary ?? true,
        effectiveFrom: new Date(body.effective_from),
      },
      select: {
        id: true, personId: true, roleType: true,
        seniority: true, isPrimary: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
