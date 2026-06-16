import { NextRequest, NextResponse } from "next/server";
import { anomalyService } from "@/lib/db";
import type { SuggestionStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const { suggestionId } = await params;
  const body = (await req.json()) as { status: string; dismissed_reason?: string };

  const suggestion = await anomalyService.updateSuggestionStatus(
    Number(suggestionId),
    body.status as SuggestionStatus
  );
  return NextResponse.json(suggestion);
}
