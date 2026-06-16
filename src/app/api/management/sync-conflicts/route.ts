import { NextRequest, NextResponse } from "next/server";
import { syncService } from "@/lib/db";
import type { SyncConflictCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  try {
    const rows = await syncService.listSyncConflicts({
      category: category ? (category as SyncConflictCategory) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
