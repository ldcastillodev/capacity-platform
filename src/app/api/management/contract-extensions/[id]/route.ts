import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const TERMINAL = ["rejected", "closed"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ext = await prisma.contractExtension.findUnique({ where: { id: Number(id) } });
    if (!ext) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (TERMINAL.includes(ext.status))
      return NextResponse.json({ error: "Extension is in a terminal state and cannot be edited." }, { status: 400 });

    const body = await req.json() as {
      requested_hours?: number; role_type?: string | null;
      rate_override?: number | null; notes?: string | null;
    };
    const row = await prisma.contractExtension.update({
      where: { id: Number(id) },
      data: {
        ...(body.requested_hours !== undefined && { requestedHours: body.requested_hours }),
        ...(body.role_type !== undefined && { roleType: body.role_type as never }),
        ...(body.rate_override !== undefined && { rateOverride: body.rate_override }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      select: {
        id: true, clientId: true, month: true, type: true, status: true,
        requestedHours: true, roleType: true, rateOverride: true,
        approvedBy: true, approvedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
