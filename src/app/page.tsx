"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBurnByContract, fetchDashboard, type BurnByContractRow } from "@/lib/client";
import type { ContractHealthStatus } from "@/lib/analytics/contract-status";
import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const LEVEL_COLOR: Record<ContractHealthStatus, string> = {
  critical: "var(--critical)",
  watch: "var(--watch)",
  underconsumption: "var(--warning)",
  on_track: "var(--safe)",
};

const LEVEL_BG: Record<ContractHealthStatus, string> = {
  critical: "rgba(239,68,68,0.06)",
  watch: "rgba(234,179,8,0.06)",
  underconsumption: "rgba(249,115,22,0.06)",
  on_track: "rgba(34,197,94,0.06)",
};

const LEVEL_LABEL: Record<ContractHealthStatus, string> = {
  critical: "Critical",
  watch: "Watch",
  underconsumption: "Underconsumption",
  on_track: "On Track",
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

  const groupedContracts: Partial<Record<ContractHealthStatus, BurnByContractRow[]>> = {};
  for (const row of contractBurn ?? []) {
    (groupedContracts[row.status] ??= []).push(row);
  }

  const displayLevels: ContractHealthStatus[] = [
    "critical",
    "watch",
    "underconsumption",
    "on_track",
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description={formatMonthDisplay(month)}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {isLoading && (
        <MetricCardGrid className="mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </MetricCardGrid>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--critical)" }}>
          Could not load dashboard. Make sure the API is running.
        </p>
      )}

      {!isLoading && data && (
        <>
          <MetricCardGrid className="mb-8">
            <StatCard
              label="On Track"
              value={groupedContracts.on_track?.length ?? 0}
              valueColor="var(--safe)"
            />
            <StatCard
              label="Underconsumption"
              value={groupedContracts.underconsumption?.length ?? 0}
              valueColor="var(--warning)"
            />
            <StatCard
              label="Watch"
              value={groupedContracts.watch?.length ?? 0}
              valueColor="var(--watch)"
            />
            <StatCard
              label="Critical"
              value={groupedContracts.critical?.length ?? 0}
              valueColor="var(--critical)"
            />
            <StatCard
              label="Open Flags"
              value={data.open_anomaly_flags}
              valueColor={data.open_anomaly_flags > 0 ? "var(--warning)" : undefined}
            />
            <StatCard label="Active Contracts" value={contractBurn?.length ?? 0} />
            <StatCard label="Persons" value={data.persons_count} />
            <StatCard label="Squads" value={data.squads_count} />
          </MetricCardGrid>

          {data.total_active_clients === 0 && (
            <Card className="max-w-lg mb-8 border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-primary">Getting started</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
                  <li>Add squads and people via the API</li>
                  <li>Create clients and retainer contracts</li>
                  <li>Submit monthly role declarations</li>
                  <li>Log hours — burn rate and flags will appear automatically</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {(contractBurn ?? []).length > 0 && (
            <div className="mb-10">
              <h2 className="font-semibold text-base mb-4">Contract Status Breakdown</h2>
              <div className="flex flex-col gap-4">
                {displayLevels.map((level) => {
                  const contracts = groupedContracts[level];
                  if (!contracts || contracts.length === 0) return null;
                  const color = LEVEL_COLOR[level];
                  const bg = LEVEL_BG[level];
                  const label = LEVEL_LABEL[level];
                  return (
                    <div
                      key={level}
                      className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${color}` }}
                    >
                      <div
                        className="flex items-center gap-2.5 px-4 py-2.5 border-b"
                        style={{ background: bg, borderColor: color }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: color }}
                        />
                        <span className="font-bold text-sm" style={{ color }}>
                          {label}
                        </span>
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-1 text-white"
                          style={{ background: color }}
                        >
                          {contracts.length}
                        </span>
                      </div>
                      {contracts.map((row, i) => {
                        const pct = row.consumption_pct * 100;
                        return (
                          <div
                            key={row.contract_id}
                            className="grid items-center gap-4 px-4 py-3"
                            style={{
                              gridTemplateColumns: "1fr auto",
                              background:
                                i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--background))",
                              borderBottom:
                                i < contracts.length - 1 ? `1px solid hsl(var(--border))` : "none",
                            }}
                          >
                            <div>
                              <div className="font-semibold text-sm mb-0.5">
                                {row.contract_name}
                              </div>
                              <div className="text-xs text-muted-foreground">{row.client_name}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div
                                className="text-sm font-bold"
                                style={{
                                  color:
                                    pct > 110
                                      ? "var(--critical)"
                                      : pct > 90
                                        ? "var(--watch)"
                                        : undefined,
                                }}
                              >
                                {row.consumed_hours.toFixed(0)}h / {row.pool_hours.toFixed(0)}h
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {pct.toFixed(1)}% consumption
                                {row.hour_type === "total" ? " · lifetime" : ""}
                              </div>
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
        </>
      )}
    </div>
  );
}
