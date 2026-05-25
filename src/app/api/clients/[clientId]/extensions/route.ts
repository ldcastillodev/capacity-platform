import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const extensions = await prisma.contractExtension.findMany({
    where: { clientId: Number(clientId) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(extensions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const body = await req.json() as {
    month: string;
    requested_hours: number;
    type?: string;
    status?: string;
    role_type?: string;
    notes?: string;
    rate_override?: number;
  };

  const ext = await prisma.contractExtension.create({
    data: {
      clientId: Number(clientId),
      month: new Date(body.month),
      type: (body.type as never) ?? "te",
      status: (body.status as never) ?? "pending_approval",
      requestedHours: body.requested_hours,
      roleType: (body.role_type as never) ?? null,
      notes: body.notes ?? null,
      rateOverride: body.rate_override ?? null,
    },
  });
  return NextResponse.json(ext, { status: 201 });
}
