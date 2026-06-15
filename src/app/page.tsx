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
import { cn } from "@/lib/utils";
import React from "react";

const LEVEL_CLASSES: Record<
  ContractHealthStatus,
  { border: string; headerBg: string; dot: string; text: string; countBg: string }
> = {
  critical: {
    border: "border-critical",
    headerBg: "bg-critical-bg",
    dot: "bg-critical",
    text: "text-critical",
    countBg: "bg-critical",
  },
  watch: {
    border: "border-watch",
    headerBg: "bg-watch-bg",
    dot: "bg-watch",
    text: "text-watch",
    countBg: "bg-watch",
  },
  underconsumption: {
    border: "border-warning",
    headerBg: "bg-warning-bg",
    dot: "bg-warning",
    text: "text-warning",
    countBg: "bg-warning",
  },
  on_track: {
    border: "border-safe",
    headerBg: "bg-safe-bg",
    dot: "bg-safe",
    text: "text-safe",
    countBg: "bg-safe",
  },
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
        <p className="text-sm text-critical">
          Could not load dashboard. Make sure the API is running.
        </p>
      )}

      {!isLoading && data && (
        <>
          <MetricCardGrid className="mb-8">
            <StatCard
              label="On Track"
              value={groupedContracts.on_track?.length ?? 0}
              valueTone="safe"
            />
            <StatCard
              label="Underconsumption"
              value={groupedContracts.underconsumption?.length ?? 0}
              valueTone="warning"
            />
            <StatCard label="Watch" value={groupedContracts.watch?.length ?? 0} valueTone="watch" />
            <StatCard
              label="Critical"
              value={groupedContracts.critical?.length ?? 0}
              valueTone="critical"
            />
            <StatCard
              label="Open Flags"
              value={data.open_anomaly_flags}
              valueTone={data.open_anomaly_flags > 0 ? "warning" : undefined}
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
                  const c = LEVEL_CLASSES[level];
                  const label = LEVEL_LABEL[level];
                  return (
                    <div
                      key={level}
                      className={cn(
                        "rounded-xl overflow-hidden border animate-slide-up-fade",
                        c.border
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 border-b",
                          c.border,
                          c.headerBg
                        )}
                      >
                        <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", c.dot)} />
                        <span className={cn("font-bold text-sm", c.text)}>{label}</span>
                        <span
                          className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded-full ml-1 text-white",
                            c.countBg
                          )}
                        >
                          {contracts.length}
                        </span>
                      </div>
                      {contracts.map((row, i) => {
                        const pct = row.consumption_pct * 100;
                        return (
                          <div
                            key={row.contract_id}
                            className={cn(
                              "grid items-center gap-4 px-4 py-3 grid-cols-[1fr_auto]",
                              i % 2 === 0 ? "bg-card" : "bg-background",
                              i < contracts.length - 1 && "border-b border-border"
                            )}
                          >
                            <div>
                              <div className="font-semibold text-sm mb-0.5">
                                {row.contract_name}
                              </div>
                              <div className="text-xs text-muted-foreground">{row.client_name}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div
                                className={cn(
                                  "text-sm font-bold",
                                  pct > 110 ? "text-critical" : pct > 90 ? "text-watch" : undefined
                                )}
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
