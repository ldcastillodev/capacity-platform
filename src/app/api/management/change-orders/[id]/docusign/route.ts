import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: Number(id) } });
    if (!co) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (co.status !== "pending_docusign")
      return NextResponse.json({ error: "Change order must be in pending_docusign status." }, { status: 400 });

    const body = await req.json() as { docusign_envelope_id: string };
    if (!body.docusign_envelope_id)
      return NextResponse.json({ error: "docusign_envelope_id is required." }, { status: 400 });

    const row = await prisma.changeOrder.update({
      where: { id: Number(id) },
      data: {
        status: "approved",
        docusignEnvelopeId: body.docusign_envelope_id,
        docusignSignedAt: new Date(),
      },
      select: { id: true, status: true, docusignEnvelopeId: true, docusignSignedAt: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
