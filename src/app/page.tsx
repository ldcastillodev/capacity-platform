"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchBurnSnapshots,
  fetchBurnByContract,
  fetchClients,
  fetchDashboard,
  type AlertLevel,
  type BurnSnapshot,
  type BurnByContractRow,
} from "@/lib/client";
import AlertBadge from "@/components/AlertBadge";
import { StatCard } from "@/components/StatCard";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import React from "react";

const ALERT_ORDER: Record<AlertLevel, number> = {
  critical: 0,
  warning: 1,
  watch: 2,
  safe: 3,
};

function burnReason(snap: BurnSnapshot): string {
  const actual = parseFloat(String(snap.cumulative_hours));
  const pool = parseFloat(String(snap.pool_hours));
  const expected = parseFloat(String(snap.expected_cumulative));
  const projectedEom = parseFloat(String(snap.projected_eom_hours));
  const ratio = parseFloat(String(snap.burn_rate_ratio));
  const utilPct = pool > 0 ? (actual / pool) * 100 : 0;
  const projectedPct = pool > 0 ? (projectedEom / pool) * 100 : 0;

  if (actual === 0) return "No hours logged yet this month";
  if (actual > pool) return `Over pool — ${actual.toFixed(0)}h consumed of ${pool.toFixed(0)}h (${utilPct.toFixed(0)}%)`;
  if (projectedEom > pool * 1.1) return `Overburn risk — projected ${projectedEom.toFixed(0)}h vs ${pool.toFixed(0)}h pool (${projectedPct.toFixed(0)}%)`;
  if (projectedEom > pool) return `Slightly over pace — projected ${projectedEom.toFixed(0)}h vs ${pool.toFixed(0)}h pool`;
  if (ratio < 0.20) return `Far below expected pace — ${(ratio * 100).toFixed(0)}% of expected burn rate`;
  if (ratio < 0.40) return `Below expected pace — ${(ratio * 100).toFixed(0)}% of expected burn rate`;
  if (ratio < 0.60) return `Slightly below pace — ${actual.toFixed(0)}h consumed, expected ${expected.toFixed(0)}h by now`;
  if (projectedEom > pool * 0.95) return `Tracking high — ${actual.toFixed(0)}h of ${pool.toFixed(0)}h used (${utilPct.toFixed(0)}%)`;
  return `On pace — ${actual.toFixed(0)}h of ${pool.toFixed(0)}h used (${utilPct.toFixed(0)}%)`;
}

const LEVEL_COLOR: Record<AlertLevel, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  watch: "var(--watch)",
  safe: "var(--safe)",
};

const LEVEL_BG: Record<AlertLevel, string> = {
  critical: "rgba(239,68,68,0.06)",
  warning: "rgba(249,115,22,0.06)",
  watch: "rgba(234,179,8,0.06)",
  safe: "rgba(34,197,94,0.06)",
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "Critical",
  warning: "Warning",
  watch: "Watch",
  safe: "On Track",
};

export default function DashboardPage() {
  const [month, setMonth] = useMonth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", month],
    queryFn: () => fetchDashboard(month),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const { data: burnSnapshots } = useQuery({
    queryKey: ["burn", month],
    queryFn: () => fetchBurnSnapshots({ month }),
  });

  const { data: contractBurn } = useQuery({
    queryKey: ["burn-by-contract", month],
    queryFn: () => fetchBurnByContract({ month }),
  });

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--critical)" }}>Could not load dashboard. Make sure the API is running.</p>;

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  const latestByClient = new Map<number, BurnSnapshot>();
  for (const snap of burnSnapshots ?? []) {
    if (snap.role_type !== null) continue;
    const existing = latestByClient.get(snap.client_id);
    if (!existing || snap.week_start > existing.week_start) {
      latestByClient.set(snap.client_id, snap);
    }
  }

  const sortedSnaps = Array.from(latestByClient.values()).sort((a, b) => {
    const levelDiff = ALERT_ORDER[a.alert_level] - ALERT_ORDER[b.alert_level];
    if (levelDiff !== 0) return levelDiff;
    return parseFloat(String(b.projected_eom_hours)) - parseFloat(String(a.projected_eom_hours));
  });

  const grouped: Partial<Record<AlertLevel, BurnSnapshot[]>> = {};
  for (const snap of sortedSnaps) {
    (grouped[snap.alert_level] ??= []).push(snap);
  }

  const displayLevels: AlertLevel[] = ["critical", "warning", "watch", "safe"];

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13,
    color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
    background: "var(--bg)", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 14,
  };

  function contractAlertLevel(row: BurnByContractRow): AlertLevel {
    const p = row.utilization_pct;
    if (row.consumed_hours === 0) return "watch";
    if (p > 1.1 || p < 0.2) return "critical";
    if (p >= 0.9 || p < 0.4) return "watch";
    return "safe";
  }

  const groupedContracts: Partial<Record<AlertLevel, BurnByContractRow[]>> = {};
  for (const row of contractBurn ?? []) {
    const level = contractAlertLevel(row);
    (groupedContracts[level] ??= []).push(row);
  }

  const topBurn = (burnSnapshots ?? [])
    .filter((s) => s.role_type === null)
    .sort((a, b) => (ALERT_ORDER[a.alert_level] ?? 99) - (ALERT_ORDER[b.alert_level] ?? 99))
    .slice(0, 10);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Overview</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{formatMonthDisplay(month)}</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Active Clients" value={data!.total_active_clients} />
        <StatCard label="On Track" value={data!.clients_on_track} color="var(--safe)" />
        <StatCard label="At Risk" value={data!.clients_at_risk} color="var(--watch)" />
        <StatCard label="Critical" value={data!.clients_critical} color="var(--critical)" />
        <StatCard label="Open Flags" value={data!.open_anomaly_flags} color={data!.open_anomaly_flags > 0 ? "var(--warning)" : undefined} />
        <StatCard label="Understaffed Roles" value={data!.understaffed_roles} color={data!.understaffed_roles > 0 ? "var(--critical)" : undefined} />
        <StatCard
          label="Avg Gross Margin"
          value={data!.total_gross_margin_pct != null ? `${(+data!.total_gross_margin_pct * 100).toFixed(1)}%` : "—"}
          sub="across active clients"
        />
      </div>

      {data!.total_active_clients === 0 && (
        <div style={{ background: "var(--primary-light)", border: "1px solid #bfdbfe", borderRadius: 12, padding: 24, maxWidth: 560, marginBottom: 32 }}>
          <p style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>Getting started</p>
          <ol style={{ paddingLeft: 20, lineHeight: 2, color: "var(--text-muted)" }}>
            <li>Add squads and people via the API</li>
            <li>Create clients and retainer contracts</li>
            <li>Submit monthly role declarations</li>
            <li>Log hours — burn rate and flags will appear automatically</li>
          </ol>
        </div>
      )}

      {sortedSnaps.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Client Status Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayLevels.map((level) => {
              const snaps = grouped[level];
              if (!snaps || snaps.length === 0) return null;
              const color = LEVEL_COLOR[level];
              const bg = LEVEL_BG[level];
              const label = LEVEL_LABEL[level];
              return (
                <div key={level} style={{ border: `1px solid ${color}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: bg, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${color}` }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color }}>{label}</span>
                    <span style={{ marginLeft: 4, background: color, color: "#FDFDFD", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{snaps.length}</span>
                  </div>
                  {snaps.map((snap, i) => {
                    const name = clientMap[snap.client_id] ?? `Client ${snap.client_id}`;
                    const reason = burnReason(snap);
                    const actual = parseFloat(String(snap.cumulative_hours));
                    const pool = parseFloat(String(snap.pool_hours));
                    const pct = pool > 0 ? (actual / pool) * 100 : 0;
                    const projectedEom = parseFloat(String(snap.projected_eom_hours));
                    return (
                      <div key={snap.client_id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16, padding: "12px 16px", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: i < snaps.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{reason}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: pct > 100 ? "var(--critical)" : pct > 90 ? "var(--watch)" : "var(--text)" }}>
                            {actual.toFixed(0)}h / {pool.toFixed(0)}h
                          </div>
                          {projectedEom > 0 && projectedEom !== actual && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>proj. EOM {projectedEom.toFixed(0)}h</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(contractBurn ?? []).length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Contract Status Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayLevels.map((level) => {
              const contracts = groupedContracts[level];
              if (!contracts || contracts.length === 0) return null;
              const color = LEVEL_COLOR[level];
              const bg = LEVEL_BG[level];
              const label = LEVEL_LABEL[level];
              return (
                <div key={level} style={{ border: `1px solid ${color}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: bg, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${color}` }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color }}>{label}</span>
                    <span style={{ marginLeft: 4, background: color, color: "#FDFDFD", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{contracts.length}</span>
                  </div>
                  {contracts.map((row, i) => {
                    const pct = row.utilization_pct * 100;
                    return (
                      <div key={row.contract_id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16, padding: "12px 16px", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: i < contracts.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{row.contract_name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.client_name}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: pct > 110 ? "var(--critical)" : pct > 90 ? "var(--watch)" : "var(--text)" }}>
                            {row.consumed_hours.toFixed(0)}h / {row.pool_hours.toFixed(0)}h
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{pct.toFixed(1)}% utilization</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topBurn.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Burn Rate Detail — Top {topBurn.length} Clients</div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Alert Level</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Hours Consumed</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Pool Hours</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Burn Ratio</th>
                </tr>
              </thead>
              <tbody>
                {topBurn.map((snap, i) => {
                  const burnRatio = parseFloat(String(snap.burn_rate_ratio));
                  const consumed = parseFloat(String(snap.cumulative_hours));
                  const pool = parseFloat(String(snap.pool_hours));
                  return (
                    <tr
                      key={`${snap.client_id}-${snap.week_start}`}
                      style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--primary-light)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "var(--surface)" : "var(--bg)"; }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{clientMap[snap.client_id] ?? `Client ${snap.client_id}`}</td>
                      <td style={tdStyle}><AlertBadge level={snap.alert_level} /></td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{consumed.toFixed(1)}h</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{pool.toFixed(1)}h</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: burnRatio > 1.1 ? "var(--critical)" : burnRatio > 0.9 ? "var(--watch)" : "var(--safe)" }}>
                        {(burnRatio * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
