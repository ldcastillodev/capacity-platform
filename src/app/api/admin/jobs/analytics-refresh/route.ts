import { NextRequest, NextResponse } from "next/server";
import { runAnalyticsRefresh } from "@/lib/analytics/refresh";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { months?: string[] };
  const started = Date.now();

  const months = body.months?.map((s) => new Date(s));
  await runAnalyticsRefresh(months);

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
  });
}
