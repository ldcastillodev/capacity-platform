import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");
  const openOnly = searchParams.get("open_only") === "true";

  const flags = await anomalyService.listAnomalyFlags({
    month: month ? new Date(month) : undefined,
    squadId: squadId ? Number(squadId) : undefined,
    openOnly,
  });

  return NextResponse.json(flags);
}
