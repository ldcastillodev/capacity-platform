import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");
  const openOnly = searchParams.get("open_only") === "true";

  const flags = await prisma.anomalyFlag.findMany({
    where: {
      ...(month ? { month: new Date(month) } : {}),
      ...(squadId ? { squadId: Number(squadId) } : {}),
      ...(openOnly ? { resolvedAt: null } : {}),
    },
    include: { squad: true, client: true },
    orderBy: [{ severity: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(flags);
}
