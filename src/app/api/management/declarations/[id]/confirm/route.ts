import { NextRequest, NextResponse } from "next/server";
import { declarationService } from "@/lib/db";
import { DeclarationStatus } from "@prisma/client";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const decl = await declarationService.findDeclarationById(Number(id));
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (decl.status !== "draft")
      return NextResponse.json(
        { error: "Only draft declarations can be confirmed." },
        { status: 400 }
      );

    const row = await declarationService.setDeclarationStatus(
      Number(id),
      DeclarationStatus.confirmed
    );
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
