"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchBurnByContract,
  fetchDashboard,
  type AlertLevel,
  type BurnByContractRow,
} from "@/lib/client";
import { StatCard } from "@/components/StatCard";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import React from "react";


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

  const { data: contractBurn } = useQuery({
    queryKey: ["burn-by-contract", month],
    queryFn: () => fetchBurnByContract({ month }),
  });

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--critical)" }}>Could not load dashboard. Make sure the API is running.</p>;

  const displayLevels: AlertLevel[] = ["critical", "warning", "watch", "safe"];

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

    </div>
  );
}
