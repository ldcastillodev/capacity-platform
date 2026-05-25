import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const body = await req.json() as {
    role_type: string;
    seniority?: string;
    is_primary?: boolean;
    effective_from: string;
    effective_to?: string;
  };

  const role = await prisma.personRole.create({
    data: {
      personId: Number(personId),
      roleType: body.role_type as never,
      seniority: (body.seniority as never) ?? null,
      isPrimary: body.is_primary ?? true,
      effectiveFrom: new Date(body.effective_from),
      effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
    },
  });
  return NextResponse.json(role, { status: 201 });
}
