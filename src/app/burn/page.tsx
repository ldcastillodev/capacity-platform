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
import { fetchBurnByContractWeekly } from "@/lib/client";
import AlertBadge from "@/components/AlertBadge";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

type View = "by_contract";

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13,
  color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
  background: "var(--bg)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 14 };

import type React from "react";

export default function BurnPage() {
  const [month, setMonth] = useMonth();
  const [view] = useState<View>("by_contract");

  const { data: contractWeekly, isLoading } = useQuery({
    queryKey: ["burn-by-contract-weekly", month],
    queryFn: () => fetchBurnByContractWeekly({ month }),
  });

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

      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

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
