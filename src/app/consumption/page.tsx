"use client";

import type React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchClients,
  fetchConsumption,
} from "@/lib/client";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

function fmtHours(h: number): string { return h.toFixed(1) + "h"; }

function utilizationColor(pct: number, declared: number): string {
  if (declared === 0) return "var(--text-muted)";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

function utilizationBarColor(pct: number, declared: number): string {
  if (declared === 0) return "var(--border)";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 14 };

export default function ConsumptionPage() {
  const [month, setMonth] = useMonth();

  const { data: consumptionRaw, isLoading } = useQuery({ queryKey: ["consumption", month], queryFn: () => fetchConsumption({ month }) });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  const rolledUp = (consumptionRaw ?? [])
    .filter((r) => (r.role_type ?? r.roleType) === null)
    .map((r) => {
      const declared = parseFloat(String(r.declared_hours ?? r.declaredHours ?? 0));
      const consumed = parseFloat(String(r.consumed_hours ?? r.consumedHours ?? 0));
      return { client_id: r.client_id ?? r.clientId, declared_hours: declared, consumed_hours: consumed, remaining_hours: declared > 0 ? declared - consumed : parseFloat(String(r.remaining_hours ?? r.remainingHours ?? 0)), utilization_pct: declared > 0 ? consumed / declared : 0 };
    });

  const tableRows = rolledUp.map((r) => {
    return {
      clientId: r.client_id,
      clientName: clientMap[r.client_id] ?? `Client ${r.client_id}`,
      declared: r.declared_hours,
      consumed: r.consumed_hours,
      remaining: r.remaining_hours,
      utilization: r.utilization_pct,
    };
  }).sort((a, b) => b.utilization - a.utilization);

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Hours Consumption</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{formatMonthDisplay(month)} · Declared vs Actual</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
        {tableRows.length === 0
          ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No consumption data for this period.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Retainer</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Consumed</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Remaining</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => {
                  const isDeclaredZero = row.declared === 0;
                  const clampedPct = Math.min(row.utilization, 1);
                  const barFill = utilizationBarColor(row.utilization, row.declared);
                  const textColor = utilizationColor(row.utilization, row.declared);
                  return (
                    <tr
                      key={row.clientId}
                      style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--primary-light)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "var(--surface)" : "var(--bg)"; }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{row.clientName}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-muted)" }}>{row.declared > 0 ? fmtHours(row.declared) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtHours(row.consumed)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.remaining < 0 ? "var(--critical)" : "var(--text)" }}>{isDeclaredZero ? "—" : fmtHours(row.remaining)}</td>
                      <td style={tdStyle}>
                        {isDeclaredZero ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden", minWidth: 80 }}>
                              <div style={{ width: `${(clampedPct * 100).toFixed(1)}%`, height: "100%", background: barFill, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: textColor, minWidth: 46, textAlign: "right" }}>{(row.utilization * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
