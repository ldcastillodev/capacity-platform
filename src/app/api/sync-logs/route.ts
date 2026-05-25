import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const limit = Number(searchParams.get("limit") ?? "50");

  const logs = await prisma.syncLog.findMany({
    where: source ? { source: source as never } : undefined,
    orderBy: { startedAt: "desc" },
    take: Math.min(limit, 200),
  });
  return NextResponse.json(logs);
}
