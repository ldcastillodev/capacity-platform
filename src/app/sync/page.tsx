"use client";

import React, { useEffect, useState } from "react";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function getSource(tempo: boolean, jira: boolean): "tempo" | "jira_na" | "all" {
  if (tempo && !jira) return "tempo";
  if (!tempo && jira) return "jira_na";
  return "all";
}

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
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

type BannerResult = { ok: boolean; message: string } | null;

interface SyncLogEntry {
  id: number;
  source: "tempo" | "jira_na";
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 24,
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};

const dateInput: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 14,
  color: "var(--text)",
  background: "var(--bg)",
  outline: "none",
};

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "var(--primary)",
        color: "#FDFDFD",
        border: "none",
        borderRadius: 7,
        padding: "9px 20px",
        fontSize: 14,
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {loading && (
        <span
          style={{
            width: 13,
            height: 13,
            border: "2px solid rgba(255,255,255,0.4)",
            borderTopColor: "#FDFDFD",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
      )}
      {children}
    </button>
  );
}

function Banner({ result }: { result: BannerResult }) {
  if (!result) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 14px",
        borderRadius: 7,
        fontSize: 13,
        background: result.ok ? "var(--safe-bg)" : "var(--critical-bg)",
        color: result.ok ? "var(--safe)" : "var(--critical)",
        border: `1px solid ${result.ok ? "var(--safe)" : "var(--critical)"}`,
      }}
    >
      {result.message}
    </div>
  );
}

function LastSyncStatus({ logs }: { logs: SyncLogEntry[] }) {
  if (logs.length === 0) return null;

  const sourceLabel: Record<string, string> = { tempo: "Tempo", jira_na: "Jira NA" };

  return (
    <div style={card}>
      <div style={{ fontWeight: 600, marginBottom: 16 }}>Last Sync Status</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {logs.map((log) => (
            <div
              key={log.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "14px 16px",
                background: "var(--safe-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {sourceLabel[log.source] ?? log.source}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--safe)",
                    color: "#FDFDFD",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {log.completedAt ? "Success" : "Running"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Date &amp; Time</div>
                  <div style={{ fontSize: 13 }}>{fmtDateTime(log.startedAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Date Range</div>
                  <div style={{ fontSize: 13 }}>
                    {log.dateFrom && log.dateTo
                      ? `${fmtDate(log.dateFrom)} – ${fmtDate(log.dateTo)}`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function SyncPage() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [tempoChecked, setTempoChecked] = useState(true);
  const [jiraChecked, setJiraChecked] = useState(true);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<BannerResult>(null);

  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshResult, setRefreshResult] = useState<BannerResult>(null);

  const [lastLogs, setLastLogs] = useState<SyncLogEntry[]>([]);

  async function fetchLastLogs() {
    try {
      const res = await fetch("/api/admin/jobs/sync");
      if (res.ok) {
        const data = await res.json();
        setLastLogs(data.logs ?? []);
      }
    } catch {
      // non-critical — ignore
    }
  }

  useEffect(() => { fetchLastLogs(); }, []);

  async function runSync() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/jobs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: getSource(tempoChecked, jiraChecked),
          date_from: dateFrom,
          date_to: dateTo,
        }),
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
    } finally {
      setSyncLoading(false);
    }
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
    } finally {
      setRefreshLoading(false);
    }
  }

  const months = getMonthsArray(dateFrom, dateTo);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sync</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Trigger data sync from Jira/Tempo and analytics refresh.
        </p>
      </div>

      <LastSyncStatus logs={lastLogs} />

      {/* Date Range */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Date Range</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={dateInput}
            />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={dateInput}
            />
          </div>
        </div>
      </div>

      {/* Data Sync */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Data Sync</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          Pull hour records from selected sources into the database.
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          {(
            [
              { id: "tempo", label: "Tempo", checked: tempoChecked, set: setTempoChecked },
              { id: "jira",  label: "Jira NA", checked: jiraChecked,  set: setJiraChecked  },
            ] as const
          ).map(({ id, label: lbl, checked, set }) => (
            <label
              key={id}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => set(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--primary)" }}
              />
              {lbl}
            </label>
          ))}
        </div>
        <PrimaryButton
          onClick={runSync}
          disabled={syncLoading || (!tempoChecked && !jiraChecked)}
          loading={syncLoading}
        >
          {syncLoading ? "Running…" : "Run Sync"}
        </PrimaryButton>
        <Banner result={syncResult} />
      </div>

      {/* Analytics Refresh */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Analytics Refresh</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          Recalculate consumption summaries, staffing gaps, and anomaly flags.
          Will refresh <strong>{months.length}</strong> month{months.length !== 1 ? "s" : ""} based
          on the selected date range.
        </div>
        <PrimaryButton
          onClick={runRefresh}
          disabled={refreshLoading || months.length === 0}
          loading={refreshLoading}
        >
          {refreshLoading ? "Running…" : "Run Analytics Refresh"}
        </PrimaryButton>
        <Banner result={refreshResult} />
      </div>
    </>
  );
}
