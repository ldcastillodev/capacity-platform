import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> },
) {
  const { suggestionId } = await params;
  const body = await req.json() as { status: string; dismissed_reason?: string };

  const suggestion = await prisma.nonBillableEnhancementSuggestion.update({
    where: { id: Number(suggestionId) },
    data: {
      status: body.status as never,
    },
  });
  return NextResponse.json(suggestion);
}
