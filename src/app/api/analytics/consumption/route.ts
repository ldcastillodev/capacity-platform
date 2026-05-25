import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const clientId = searchParams.get("client_id");
  const squadId = searchParams.get("squad_id");

  const summaries = await prisma.monthlyConsumptionSummary.findMany({
    where: {
      ...(month ? { month: new Date(month) } : {}),
      ...(clientId ? { clientId: Number(clientId) } : {}),
    },
    include: { client: true },
    orderBy: [{ month: "desc" }, { clientId: "asc" }],
  });

  return NextResponse.json(summaries);
}
