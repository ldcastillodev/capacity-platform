import { NextRequest, NextResponse } from "next/server";
import { syncService } from "@/lib/db";
import type { SyncSource } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const limit = Number(searchParams.get("limit") ?? "50");

  const logs = await syncService.listSyncLogs({
    source: source ? (source as SyncSource) : undefined,
    limit,
  });
  return NextResponse.json(logs);
}
