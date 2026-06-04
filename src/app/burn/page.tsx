"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchBurnSnapshots, fetchBurnByContract, fetchBurnByContractWeekly, fetchClients } from "@/lib/client";
import AlertBadge from "@/components/AlertBadge";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

type View = "by_client" | "by_contract";

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13,
  color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
  background: "var(--bg)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 14 };

import type React from "react";

export default function BurnPage() {
  const [month, setMonth] = useMonth();
  const [view, setView] = useState<View>("by_client");

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ["burn", month],
    queryFn: () => fetchBurnSnapshots({ month }),
    enabled: view === "by_client",
  });
  const { data: contractRows, isLoading: contractLoading } = useQuery({
    queryKey: ["burn-by-contract", month],
    queryFn: () => fetchBurnByContract({ month }),
    enabled: view === "by_contract",
  });
  const { data: contractWeekly, isLoading: contractWeeklyLoading } = useQuery({
    queryKey: ["burn-by-contract-weekly", month],
    queryFn: () => fetchBurnByContractWeekly({ month }),
    enabled: view === "by_contract",
  });

  const isLoading = view === "by_client" ? snapshotsLoading : (contractLoading || contractWeeklyLoading);

  const byClient: Record<number, typeof snapshots> = {};
  if (view === "by_client") {
    for (const s of snapshots ?? []) {
      if (!s.role_type) {
        byClient[s.client_id] ??= [];
        byClient[s.client_id]!.push(s);
      }
    }
    for (const id of Object.keys(byClient)) {
      byClient[+id]!.sort((a, b) => a.week_start.localeCompare(b.week_start));
    }
  }

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  function viewBtn(v: View, label: string) {
    const active = view === v;
    return (
      <button
        onClick={() => setView(v)}
        style={{
          padding: "7px 16px", border: "none", background: "transparent", fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? "var(--primary)" : "var(--text-muted)",
          cursor: "pointer",
          borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
          marginBottom: -1, borderRadius: 0,
        }}
      >{label}</button>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Burn Rate</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            {formatMonthDisplay(month)} · Cumulative hours vs expected pace
          </p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {viewBtn("by_client", "By Client")}
        {viewBtn("by_contract", "By Contract")}
      </div>

      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!isLoading && view === "by_client" && (
        <>
          {Object.keys(byClient).length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>No burn data yet. Hours will appear here once logged against active contracts.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Object.entries(byClient).map(([clientId, snaps]) => {
              const latest = snaps![snaps!.length - 1];
              const chartData = snaps!.map((s) => ({
                week: new Date(s.week_start.slice(0, 10) + "T12:00:00").toLocaleDateString("default", { month: "short", day: "numeric" }),
                actual: +s.cumulative_hours,
                expected: +s.expected_cumulative,
                pool: +s.pool_hours,
              }));
              return (
                <div key={clientId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{clientMap[+clientId] ?? `Client ${clientId}`}</div>
                      {latest && (
                        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                          {parseFloat(String(latest.cumulative_hours)).toFixed(1)}h consumed of{" "}
                          {parseFloat(String(latest.pool_hours)).toFixed(1)}h pool
                          {latest.projected_exhaustion_date && (
                            <> · Pool exhausted by{" "}
                              <strong style={{ color: "var(--critical)" }}>
                                {new Date(latest.projected_exhaustion_date).toLocaleDateString()}
                              </strong>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {latest && <AlertBadge level={latest.alert_level} />}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={chartData[0]?.pool} stroke="var(--critical)" strokeDasharray="4 4" label={{ value: "Pool limit", fill: "var(--critical)", fontSize: 11 }} />
                      <Line type="monotone" dataKey="actual" stroke="var(--primary)" strokeWidth={2} dot={false} name="Actual" />
                      <Line type="monotone" dataKey="expected" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Expected pace" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!isLoading && view === "by_contract" && (
        <>
          {(contractWeekly ?? []).length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>No active contracts with hours this month.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {(contractWeekly ?? []).map((contract) => {
              const chartData = contract.weeks.map((w) => ({
                week: new Date(w.week_start.slice(0, 10) + "T12:00:00").toLocaleDateString("default", { month: "short", day: "numeric" }),
                actual: w.cumulative_hours,
                expected: w.expected_cumulative,
                pool: w.pool_hours,
              }));
              return (
                <div key={contract.contract_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{contract.contract_name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{contract.client_name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                        {contract.consumed_hours.toFixed(1)}h consumed of {contract.pool_hours.toFixed(1)}h pool
                      </div>
                    </div>
                    <AlertBadge level={contract.alert_level as import("@/lib/client").AlertLevel} />
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine y={chartData[0]?.pool} stroke="var(--critical)" strokeDasharray="4 4" label={{ value: "Pool limit", fill: "var(--critical)", fontSize: 11 }} />
                        <Line type="monotone" dataKey="actual" stroke="var(--primary)" strokeWidth={2} dot={false} name="Actual" />
                        <Line type="monotone" dataKey="expected" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Expected pace" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No weekly data available yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
