"use client";

import type React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchConsumptionByContract } from "@/lib/client";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/app/StatusBadge";

type View = "by_contract";

function fmtHours(h: number): string {
  return h.toFixed(1) + "h";
}

function consumptionColor(pct: number, declared: number): string {
  if (declared === 0) return "var(--text-muted)";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

function consumptionBarColor(pct: number, declared: number): string {
  if (declared === 0) return "hsl(var(--border))";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

export default function ConsumptionPage() {
  const [month, setMonth] = useMonth();
  const [view] = useState<View>("by_contract");

  const { data: contractRows, isLoading } = useQuery({
    queryKey: ["consumption-by-contract", month],
    queryFn: () => fetchConsumptionByContract({ month }),
  });

  return (
    <div>
      <PageHeader
        title="Hours Consumption"
        description={`${formatMonthDisplay(month)} · Declared vs Actual · total-pool contracts shown against lifetime pool`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {view === "by_contract" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (contractRows ?? []).length === 0 ? (
              <p className="p-6 text-muted-foreground">
                No active contracts with data for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Declared / Pool</TableHead>
                      <TableHead className="text-right">Prior Months</TableHead>
                      <TableHead className="text-right">Consumed (month)</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="min-w-[180px]">Consumption %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(contractRows ?? []).map((row) => {
                      const clampedPct = Math.min(row.consumption_pct, 1);
                      const barFill = consumptionBarColor(row.consumption_pct, row.declared_hours);
                      const textColor = consumptionColor(row.consumption_pct, row.declared_hours);
                      return (
                        <TableRow key={row.contract_id}>
                          <TableCell className="text-muted-foreground">{row.client_name}</TableCell>
                          <TableCell className="font-medium">{row.contract_name}</TableCell>
                          <TableCell>
                            <StatusBadge
                              tone="default"
                              label={row.hour_type === "total" ? "Total Pool" : "Monthly"}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmtHours(row.declared_hours)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.prior_consumed_hours == null
                              ? "—"
                              : fmtHours(row.prior_consumed_hours)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmtHours(row.consumed_hours)}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            style={{
                              color: row.remaining_hours < 0 ? "var(--critical)" : undefined,
                            }}
                          >
                            {fmtHours(row.remaining_hours)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden bg-border min-w-[80px]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(clampedPct * 100).toFixed(1)}%`,
                                    background: barFill,
                                  }}
                                />
                              </div>
                              <span
                                className="text-xs font-semibold min-w-[46px] text-right"
                                style={{ color: textColor }}
                              >
                                {(row.consumption_pct * 100).toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
