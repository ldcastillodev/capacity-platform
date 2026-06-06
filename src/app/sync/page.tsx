"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function todayStr(): string { return new Date().toISOString().split("T")[0]; }
function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}
function getSource(jira: boolean): "jira_na" | "all" { return jira ? "jira_na" : "all"; }
function getMonthsArray(dateFrom: string, dateTo: string): string[] {
  const months: string[] = [];
  const d = new Date(dateFrom + "T00:00:00Z");
  d.setUTCDate(1);
  const end = new Date(dateTo + "T00:00:00Z");
  while (d <= end) {
    months.push(d.toISOString().split("T")[0]);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type BannerResult = { ok: boolean; message: string } | null;
interface SyncLogEntry {
  id: number;
  source: "jira_na";
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

function Banner({ result }: { result: BannerResult }) {
  if (!result) return null;
  return (
    <div className={cn(
      "mt-3 rounded-md px-4 py-3 text-sm font-medium",
      result.ok
        ? "bg-[var(--safe-bg)] text-[var(--safe)] border border-[var(--safe)]"
        : "bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical)]"
    )}>
      {result.message}
    </div>
  );
}

export default function SyncPage() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [jiraChecked, setJiraChecked] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<BannerResult>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshResult, setRefreshResult] = useState<BannerResult>(null);
  const [lastLogs, setLastLogs] = useState<SyncLogEntry[]>([]);

  async function fetchLastLogs() {
    try {
      const res = await fetch("/api/admin/jobs/sync");
      if (res.ok) { const data = await res.json(); setLastLogs(data.logs ?? []); }
    } catch { /* non-critical */ }
  }

  useEffect(() => { fetchLastLogs(); }, []);

  async function runSync() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/jobs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: getSource(jiraChecked), date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const sources = Object.keys(data.results ?? {}).join(", ") || "all sources";
        setSyncResult({ ok: true, message: `Sync complete — ${sources} synced successfully.` });
        await fetchLastLogs();
      } else {
        setSyncResult({ ok: false, message: data.error ?? "Sync failed. Check server logs." });
        await fetchLastLogs();
      }
    } catch {
      setSyncResult({ ok: false, message: "Network error — sync request failed." });
    } finally { setSyncLoading(false); }
  }

  async function runRefresh() {
    setRefreshLoading(true);
    setRefreshResult(null);
    const months = getMonthsArray(dateFrom, dateTo);
    try {
      const res = await fetch("/api/admin/jobs/analytics-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const secs = data.durationMs ? ` (${(data.durationMs / 1000).toFixed(1)}s)` : "";
        setRefreshResult({ ok: true, message: `Analytics refresh complete — ${months.length} month(s) refreshed${secs}.` });
      } else {
        setRefreshResult({ ok: false, message: data.error ?? "Refresh failed. Check server logs." });
      }
    } catch {
      setRefreshResult({ ok: false, message: "Network error — refresh request failed." });
    } finally { setRefreshLoading(false); }
  }

  const months = getMonthsArray(dateFrom, dateTo);

  return (
    <div>
      <PageHeader
        title="Sync"
        description="Trigger data sync from Jira and analytics refresh."
      />

      {lastLogs.length > 0 && (
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Last Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastLogs.map((log) => (
              <div key={log.id} className="rounded-lg border p-4 bg-[var(--safe-bg)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{log.source === "jira_na" ? "Jira NA" : log.source}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--safe)] text-white uppercase tracking-wide">
                    {log.completedAt ? "Success" : "Running"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Date &amp; Time</div>
                    <div>{fmtDateTime(log.startedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Date Range</div>
                    <div>{log.dateFrom && log.dateTo ? `${fmtDate(log.dateFrom)} – ${fmtDate(log.dateTo)}` : "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 flex-wrap">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Data Sync</CardTitle>
          <p className="text-sm text-muted-foreground">Pull hour records from selected sources into the database.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="jira"
              checked={jiraChecked}
              onCheckedChange={(v) => setJiraChecked(Boolean(v))}
            />
            <Label htmlFor="jira">Jira NA</Label>
          </div>
          <Button onClick={runSync} disabled={syncLoading || !jiraChecked}>
            {syncLoading ? "Running…" : "Run Sync"}
          </Button>
          <Banner result={syncResult} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Analytics Refresh</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recalculate consumption summaries, staffing gaps, and anomaly flags.
            Will refresh <strong>{months.length}</strong> month{months.length !== 1 ? "s" : ""} based on the selected date range.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runRefresh} disabled={refreshLoading || months.length === 0}>
            {refreshLoading ? "Running…" : "Run Analytics Refresh"}
          </Button>
          <Banner result={refreshResult} />
        </CardContent>
      </Card>
    </div>
  );
}
