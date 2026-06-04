import { NextRequest, NextResponse } from "next/server";
import { TempoConnector } from "@/lib/integrations/tempo";
import { JiraNAConnector } from "@/lib/integrations/jira-na";
import { runAnalyticsRefresh } from "@/lib/analytics/refresh";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    source?: "tempo" | "jira_na" | "all";
    date_from?: string;
    date_to?: string;
  };

  const source = body.source ?? "all";
  const dateFrom = body.date_from ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();
  const dateTo = body.date_to ?? new Date().toISOString().split("T")[0];

  const results: Record<string, unknown> = {};

  if (source === "tempo" || source === "all") {
    const connector = new TempoConnector();
    results.tempo = await connector.sync(dateFrom, dateTo, "full");
  }

  if (source === "jira_na" || source === "all") {
    const connector = new JiraNAConnector();
    results.jira_na = await connector.sync(dateFrom, dateTo, "full");
  }

  const today = new Date();
  const thisMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const prevMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1));
  await runAnalyticsRefresh([prevMonth, thisMonth]);

  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  const rows = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      source: true,
      startedAt: true,
      completedAt: true,
      dateFrom: true,
      dateTo: true,
    },
  });

  const latest: Record<string, typeof rows[0]> = {};
  for (const row of rows) {
    if (!latest[row.source]) latest[row.source] = row;
  }

  return NextResponse.json({ logs: Object.values(latest) });
}
