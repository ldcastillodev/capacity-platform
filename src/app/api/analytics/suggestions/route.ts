import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squad_id");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  const suggestions = await prisma.nonBillableEnhancementSuggestion.findMany({
    where: {
      ...(squadId ? { squadId: Number(squadId) } : {}),
      ...(month ? { month: new Date(month) } : {}),
    },
    include: { person: true, squad: true },
    orderBy: [{ month: "desc" }, { squadId: "asc" }],
  });

  // Filter status in JS to avoid PostgreSQL enum type mismatch
  const filtered = status ? suggestions.filter((s) => s.status === status) : suggestions;

  return NextResponse.json(filtered);
}
