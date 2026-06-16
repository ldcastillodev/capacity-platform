import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";
import type { SuggestionStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const month = searchParams.get("month");
  try {
    const rows = await anomalyService.listManagedSuggestions({
      status: status ? (status as SuggestionStatus) : undefined,
      month: month ? new Date(month) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
