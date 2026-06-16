import { NextRequest, NextResponse } from "next/server";
import { JiraNAConnector } from "@/lib/integrations/jira-na";
import { runAnalyticsRefresh } from "@/lib/analytics/refresh";
import { runExpirySweep } from "@/lib/lifecycle";
import { syncService } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    source?: "jira_na";
    date_from?: string;
    date_to?: string;
  };

  const source = body.source ?? "all";
  const dateFrom =
    body.date_from ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    })();
  const dateTo = body.date_to ?? new Date().toISOString().split("T")[0];

  const results: Record<string, unknown> = {};

  // Close expired contracts/mappings before syncing so the connector's
  // status guard sees current lifecycle state.
  results.expirySweep = await runExpirySweep();

  if (source === "jira_na" || source === "all") {
    const connector = new JiraNAConnector();
    results.jira_na = await connector.sync(dateFrom, dateTo);
  }

  const today = new Date();
  const thisMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const prevMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1));
  await runAnalyticsRefresh([prevMonth, thisMonth]);

  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  const rows = await syncService.listRecentSyncLogs();

  const latest: Record<string, (typeof rows)[0]> = {};
  for (const row of rows) {
    if (!latest[row.source]) latest[row.source] = row;
  }

  return NextResponse.json({ logs: Object.values(latest) });
}
