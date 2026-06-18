"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { fetchBurnByContractWeekly } from "@/lib/client";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { formatHours } from "@/lib/utils/formatting";
import type { AlertLevel } from "@/lib/client";
import type React from "react";

type View = "by_contract";

const chartConfig = {
  actual: { label: "Actual", color: "hsl(var(--primary))" },
  expected: { label: "Expected pace", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

export default function BurnPage() {
  const [month, setMonth] = useMonth();
  const [view] = useState<View>("by_contract");

  const { data: contractWeekly, isLoading } = useQuery({
    queryKey: ["burn-by-contract-weekly", month],
    queryFn: () => fetchBurnByContractWeekly({ month }),
  });

  return (
    <div>
      <PageHeader
        title="Burn Rate"
        description={`${formatMonthDisplay(month)} · Cumulative hours vs expected pace`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {!isLoading && view === "by_contract" && (
        <>
          {(contractWeekly ?? []).length === 0 && (
            <p className="text-muted-foreground">No active contracts with hours this month.</p>
          )}
          <div className="flex flex-col gap-6">
            {(contractWeekly ?? []).map((contract) => {
              const chartData = contract.weeks.map((w) => ({
                week: new Date(w.week_start.slice(0, 10) + "T12:00:00").toLocaleDateString(
                  "default",
                  { month: "short", day: "numeric" }
                ),
                actual: w.cumulative_hours,
                expected: w.expected_cumulative,
                pool: w.pool_hours,
              }));
              const isTotal = contract.hour_type === "total";
              return (
                <Card key={contract.contract_id} className="animate-fade-in">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{contract.contract_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {contract.client_name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatHours(contract.consumed_hours)} consumed of{" "}
                          {formatHours(contract.pool_hours)} {isTotal ? "remaining pool" : "pool"}
                        </p>
                      </div>
                      {/* Pace badge: critical = ahead of pace, watch = behind (≠ overview taxonomy) */}
                      <StatusBadge
                        tone={contract.alert_level as AlertLevel}
                        label={
                          contract.alert_level === "safe"
                            ? "On Pace"
                            : contract.alert_level === "watch"
                              ? "Behind Pace"
                              : "Ahead of Pace"
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[220px] w-full">
                        <LineChart
                          data={chartData}
                          margin={{ top: 16, right: 12, left: 4, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <ReferenceLine
                            y={chartData[0]?.pool}
                            stroke="var(--critical)"
                            strokeDasharray="4 4"
                            label={{
                              value: isTotal ? "Remaining pool" : "Pool limit",
                              fill: "var(--critical)",
                              fontSize: 11,
                              position: "insideTop",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="actual"
                            stroke="var(--color-actual)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="expected"
                            stroke="var(--color-expected)"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No weekly data available yet.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
