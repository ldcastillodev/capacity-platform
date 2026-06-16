import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squad_id");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  const suggestions = await anomalyService.listSuggestions({
    squadId: squadId ? Number(squadId) : undefined,
    month: month ? new Date(month) : undefined,
  });

  // Filter status in JS to avoid PostgreSQL enum type mismatch
  const filtered = status ? suggestions.filter((s) => s.status === status) : suggestions;

  return NextResponse.json(filtered);
}
