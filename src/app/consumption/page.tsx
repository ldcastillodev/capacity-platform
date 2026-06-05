"use client";

import type React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchConsumptionByContract } from "@/lib/client";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

type View = "by_contract";

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
  const [view] = useState<View>("by_contract");

  const { data: contractRows, isLoading } = useQuery({
    queryKey: ["consumption-by-contract", month],
    queryFn: () => fetchConsumptionByContract({ month }),
  });

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

      {view === "by_contract" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
          {(contractRows ?? []).length === 0
            ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No active contracts with data for this period.</p>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Contract</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Declared</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Consumed</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Remaining</th>
                    <th style={{ ...thStyle, minWidth: 180 }}>Utilization %</th>
                  </tr>
                </thead>
                <tbody>
                  {(contractRows ?? []).map((row, i) => {
                    const clampedPct = Math.min(row.utilization_pct, 1);
                    const barFill = utilizationBarColor(row.utilization_pct, row.declared_hours);
                    const textColor = utilizationColor(row.utilization_pct, row.declared_hours);
                    return (
                      <tr key={row.contract_id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                        <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{row.client_name}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{row.contract_name}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-muted)" }}>{fmtHours(row.declared_hours)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtHours(row.consumed_hours)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: row.remaining_hours < 0 ? "var(--critical)" : "var(--text)" }}>{fmtHours(row.remaining_hours)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden", minWidth: 80 }}>
                              <div style={{ width: `${(clampedPct * 100).toFixed(1)}%`, height: "100%", background: barFill, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: textColor, minWidth: 46, textAlign: "right" }}>{(row.utilization_pct * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  );
}
