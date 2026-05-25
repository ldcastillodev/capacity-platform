import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");

  const snapshots = await prisma.staffingGapSnapshot.findMany({
    where: {
      ...(month ? { month: new Date(month) } : {}),
      ...(squadId ? { squadId: Number(squadId) } : {}),
    },
    include: { squad: true },
    orderBy: [{ month: "desc" }, { squadId: "asc" }],
  });

  return NextResponse.json(snapshots);
}
