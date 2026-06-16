import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const resolved = searchParams.get("resolved");
  try {
    const rows = await anomalyService.listManagedAnomalyFlags({
      clientId: clientId ? Number(clientId) : undefined,
      resolved: resolved === "true" ? true : resolved === "false" ? false : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
