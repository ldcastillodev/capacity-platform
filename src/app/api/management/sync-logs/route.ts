import { NextRequest, NextResponse } from "next/server";
import { syncService } from "@/lib/db";
import type { SyncSource } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  try {
    const rows = await syncService.listManagedSyncLogs({
      source: source ? (source as SyncSource) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
