"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthPicker } from "@/components/app/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditTab } from "@/components/sync/AuditTab";
import { cn } from "@/lib/utils";
import { JIRA_INSTANCES } from "@/lib/constants";
import { useSyncContext, type OpState, type JiraSourceValue } from "@/context/SyncContext";

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastDayOfMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().split("T")[0];
}
function sourceLabel(source: string): string {
  const inst = JIRA_INSTANCES.find((i) => i.source === source);
  return inst ? `Jira ${inst.label}` : source;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type BannerResult = { ok: boolean; message: string } | null;
interface SyncLogEntry {
  id: number;
  source: JiraSourceValue;
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  success: boolean;
}

function toBanner(state: OpState): BannerResult {
  if (state.status === "success" || state.status === "error") {
    return { ok: state.status === "success", message: state.message ?? "" };
  }
  return null;
}

function Banner({ result }: { result: BannerResult }) {
  if (!result) return null;
  return (
    <div
      className={cn(
        "mt-3 rounded-md px-4 py-3 text-sm font-medium",
        result.ok
          ? "bg-[var(--safe-bg)] text-[var(--safe)] border border-[var(--safe)]"
          : "bg-[var(--critical-bg)] text-[var(--critical)] border border-[var(--critical)]"
      )}
    >
      {result.message}
    </div>
  );
}

export default function SyncPage() {
  const [monthFrom, setMonthFrom] = useState(currentMonthStr);
  const [monthTo, setMonthTo] = useState(currentMonthStr);
  const [selectedSource, setSelectedSource] = useState<JiraSourceValue | null>(
    JIRA_INSTANCES[0].source
  );
  const [lastLogs, setLastLogs] = useState<SyncLogEntry[]>([]);
  const { sync, runSync } = useSyncContext();

  const dateFrom = `${monthFrom}-01`;
  const dateTo = lastDayOfMonthStr(monthTo);

  function handleMonthFromChange(value: string) {
    if (!value) return;
    setMonthFrom(value);
    if (value > monthTo) setMonthTo(value);
  }
  function handleMonthToChange(value: string) {
    if (!value) return;
    setMonthTo(value);
    if (value < monthFrom) setMonthFrom(value);
  }

  async function fetchLastLogs() {
    try {
      const res = await fetch("/api/admin/jobs/sync");
      if (res.ok) {
        const data = await res.json();
        setLastLogs(data.logs ?? []);
      }
    } catch {
      /* non-critical */
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of sync log status on mount
    fetchLastLogs();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh sync log status after a sync completes elsewhere
    if (sync.status === "success" || sync.status === "error") fetchLastLogs();
  }, [sync.status]);

  return (
    <div>
      <PageHeader title="Sync" description="Trigger data sync from Jira and analytics refresh." />

      <Tabs defaultValue="status">
        <TabsList className="mb-5">
          <TabsTrigger value="status">Sync Status</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="status">
          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Last Sync Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {JIRA_INSTANCES.map((inst) => {
                const log = lastLogs.find((l) => l.source === inst.source);
                const status = !log
                  ? "never"
                  : !log.completedAt
                    ? "running"
                    : log.success
                      ? "success"
                      : "error";
                return (
                  <div
                    key={inst.source}
                    className={cn(
                      "rounded-lg border p-4",
                      status === "error"
                        ? "bg-[var(--critical-bg)]"
                        : status === "never"
                          ? "bg-muted/40"
                          : "bg-[var(--safe-bg)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{sourceLabel(inst.source)}</span>
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wide",
                          status === "error"
                            ? "bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical)]"
                            : status === "never"
                              ? "text-muted-foreground border-muted-foreground/40"
                              : "bg-[var(--safe-bg)] text-[var(--safe)] border-[var(--safe)]"
                        )}
                      >
                        {status === "error"
                          ? "Error"
                          : status === "success"
                            ? "Success"
                            : status === "running"
                              ? "Running"
                              : "Never synced"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Date &amp; Time</div>
                        <div>{log ? fmtDateTime(log.startedAt) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Date Range</div>
                        <div>
                          {log && log.dateFrom && log.dateTo
                            ? `${fmtDate(log.dateFrom)} – ${fmtDate(log.dateTo)}`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 flex-wrap">
                <div className="flex flex-col gap-3">
                  <Label>From</Label>
                  <MonthPicker
                    value={monthFrom}
                    onChange={handleMonthFromChange}
                    className="w-44"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Label>To</Label>
                  <MonthPicker value={monthTo} onChange={handleMonthToChange} className="w-44" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Data Sync</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pull hour records from one Jira source into the database.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                {JIRA_INSTANCES.map((inst) => (
                  <div key={inst.source} className="flex items-center gap-2">
                    <Checkbox
                      id={`src-${inst.source}`}
                      checked={selectedSource === inst.source}
                      onCheckedChange={(v) => setSelectedSource(v ? inst.source : null)}
                    />
                    <Label htmlFor={`src-${inst.source}`}>{sourceLabel(inst.source)}</Label>
                  </div>
                ))}
              </div>
              <Button
                onClick={() =>
                  selectedSource && runSync({ source: selectedSource, dateFrom, dateTo })
                }
                disabled={sync.status === "running" || !selectedSource}
              >
                {sync.status === "running" ? "Running…" : "Run Sync"}
              </Button>
              <Banner result={toBanner(sync)} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
