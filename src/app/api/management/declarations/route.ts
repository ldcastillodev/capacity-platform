import { NextRequest, NextResponse } from "next/server";
import { declarationService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const month = searchParams.get("month");
  try {
    const rows = await declarationService.listManagedDeclarations({
      clientId: clientId ? Number(clientId) : undefined,
      month: month ? new Date(month) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
