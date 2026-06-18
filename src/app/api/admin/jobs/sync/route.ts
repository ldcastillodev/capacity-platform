import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JiraConnector, jiraConfigForSource } from "@/lib/integrations/jira";
import { runAnalyticsRefresh } from "@/lib/analytics/refresh";
import { runExpirySweep } from "@/lib/lifecycle";
import { syncService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";

const bodySchema = z.object({
  source: z.enum(["jira_na", "jira_emea"]),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid source — expected jira_na or jira_emea." },
      { status: 400 }
    );
  }
  const { source } = parsed.data;
  const dateFrom =
    parsed.data.date_from ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    })();
  const dateTo = parsed.data.date_to ?? new Date().toISOString().split("T")[0];

  const config = jiraConfigForSource(source);
  if (!config.baseUrl || !config.email || !config.token) {
    return NextResponse.json(
      { ok: false, error: `${source} credentials are not configured.` },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};

  // Close expired contracts/mappings before syncing so the connector's
  // status guard sees current lifecycle state.
  results.expirySweep = await runExpirySweep();

  const connector = new JiraConnector(config);
  results[source] = await connector.sync(dateFrom, dateTo);

  // Refresh analytics for every month the sync date range touched.
  const months: Date[] = [];
  const cursor = getMonthRange(new Date(dateFrom)).start;
  const lastMonth = getMonthRange(new Date(dateTo)).start;
  while (cursor <= lastMonth) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  // Analytics is best-effort: a failure here must not fail the sync.
  try {
    await runAnalyticsRefresh(months);
  } catch (e) {
    console.error("Analytics refresh failed after sync:", e);
    results.analyticsError = String(e);
  }

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
