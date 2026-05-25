import { NextRequest, NextResponse } from "next/server";
import { TempoConnector } from "@/lib/integrations/tempo";
import { JiraNAConnector } from "@/lib/integrations/jira-na";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    source?: "tempo" | "jira_na" | "all";
    date_from?: string;
    date_to?: string;
  };

  const source = body.source ?? "all";
  const dateFrom = body.date_from ? new Date(body.date_from) : (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  })();
  const dateTo = body.date_to ? new Date(body.date_to) : new Date();

  const results: Record<string, unknown> = {};

  if (source === "tempo" || source === "all") {
    const connector = new TempoConnector();
    results.tempo = await connector.sync(dateFrom, dateTo);
  }

  if (source === "jira_na" || source === "all") {
    const connector = new JiraNAConnector();
    results.jira_na = await connector.sync(dateFrom, dateTo);
  }

  return NextResponse.json({ ok: true, results });
}
