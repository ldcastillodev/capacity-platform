import { NextRequest, NextResponse } from "next/server";
import { runAnalyticsRefresh } from "@/lib/analytics/refresh";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { months?: number };
  const started = Date.now();

  await runAnalyticsRefresh(body.months);

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
  });
}
