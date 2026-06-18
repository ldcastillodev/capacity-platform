"use client";

import type React from "react";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { fetchConsumptionByContract } from "@/lib/client";
import { DailyHoursChart } from "@/components/consumption/DailyHoursChart";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/utils/formatting";

type View = "by_contract";

type Tone = "safe" | "watch" | "critical" | "muted";

function consumptionTone(pct: number, declared: number): Tone {
  if (declared === 0) return "muted";
  if (pct > 1.1) return "critical";
  if (pct < 0.2) return "critical";
  if (pct >= 0.9) return "watch";
  if (pct >= 0.4) return "safe";
  return "watch";
}

const CONTRACT_TYPE_LABEL: Record<"base" | "change_order" | "extension", string> = {
  base: "Base",
  change_order: "Change Order",
  extension: "Extension",
};

type ConsumptionRow = Awaited<ReturnType<typeof fetchConsumptionByContract>>[number];
type ConsumptionCol =
  | "client"
  | "contract"
  | "contractType"
  | "hourType"
  | "contracted"
  | "prior"
  | "consumed"
  | "remaining"
  | "pct";

const CONSUMPTION_ACCESSORS: Record<
  ConsumptionCol,
  (r: ConsumptionRow) => string | number | null | undefined
> = {
  client: (r) => r.client_name,
  contract: (r) => r.contract_name,
  contractType: (r) => (r.contract_type ? CONTRACT_TYPE_LABEL[r.contract_type] : null),
  hourType: (r) => r.hour_type,
  contracted: (r) => r.declared_hours,
  prior: (r) => r.prior_consumed_hours,
  consumed: (r) => r.consumed_hours,
  remaining: (r) => r.remaining_hours,
  pct: (r) => r.consumption_pct,
};

const TONE_TEXT: Record<Tone, string> = {
  safe: "text-safe",
  watch: "text-watch",
  critical: "text-critical",
  muted: "text-muted-foreground",
};
const TONE_FILL: Record<Tone, string> = {
  safe: "bg-safe",
  watch: "bg-watch",
  critical: "bg-critical",
  muted: "bg-border",
};

export default function ConsumptionPage() {
  const [month, setMonth] = useMonth();
  const [view] = useState<View>("by_contract");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: contractRows, isLoading } = useQuery({
    queryKey: ["consumption-by-contract", month],
    queryFn: () => fetchConsumptionByContract({ month }),
  });

  const sort = useSortState<ConsumptionCol>();
  const rows = useMemo(() => {
    const base = contractRows ?? [];
    return sort.sortKey ? sortRows(base, CONSUMPTION_ACCESSORS[sort.sortKey], sort.sortDir) : base;
  }, [contractRows, sort.sortKey, sort.sortDir]);

  return (
    <div>
      <PageHeader
        title="Hours Consumption"
        description={`${formatMonthDisplay(month)} · Contracted vs Actual · total contracts shown against lifetime hours`}
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
              <p className="p-6 text-muted-foreground">No contracts with data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead colKey="client" sort={sort}>
                        Client
                      </SortableHead>
                      <SortableHead colKey="contract" sort={sort}>
                        Contract
                      </SortableHead>
                      <SortableHead colKey="contractType" sort={sort}>
                        Contract Type
                      </SortableHead>
                      <SortableHead colKey="hourType" sort={sort}>
                        Hour Type
                      </SortableHead>
                      <SortableHead
                        colKey="contracted"
                        sort={sort}
                        align="right"
                        className="text-right"
                      >
                        Contracted
                      </SortableHead>
                      <SortableHead colKey="prior" sort={sort} align="right" className="text-right">
                        Prior Months
                      </SortableHead>
                      <SortableHead
                        colKey="consumed"
                        sort={sort}
                        align="right"
                        className="text-right"
                      >
                        Consumed (month)
                      </SortableHead>
                      <SortableHead
                        colKey="remaining"
                        sort={sort}
                        align="right"
                        className="text-right"
                      >
                        Remaining
                      </SortableHead>
                      <SortableHead colKey="pct" sort={sort} className="min-w-[180px]">
                        Consumption %
                      </SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const clampedPct = Math.min(row.consumption_pct, 1);
                      const tone = consumptionTone(row.consumption_pct, row.declared_hours);
                      const isOpen = openId === row.contract_id;
                      return (
                        <Fragment key={row.contract_id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setOpenId(isOpen ? null : row.contract_id)}
                          >
                            <TableCell className="text-muted-foreground">
                              {row.client_name}
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180"
                                  )}
                                />
                                {row.contract_name}
                                {row.contract_status !== "active" && (
                                  <StatusBadge
                                    tone="default"
                                    label={row.contract_status === "closed" ? "Closed" : "Paused"}
                                  />
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.contract_type ? CONTRACT_TYPE_LABEL[row.contract_type] : "—"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tone="default"
                                label={row.hour_type === "total" ? "Total Pool" : "Monthly"}
                              />
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatHours(row.declared_hours)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {row.prior_consumed_hours == null
                                ? "—"
                                : formatHours(row.prior_consumed_hours)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatHours(row.consumed_hours)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right",
                                row.remaining_hours < 0 && "text-critical"
                              )}
                            >
                              {formatHours(row.remaining_hours)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full overflow-hidden bg-border min-w-[80px]">
                                  {/* width is data-driven — inline style is the idiomatic exception */}
                                  <div
                                    className={cn("h-full rounded-full", TONE_FILL[tone])}
                                    style={{ width: `${(clampedPct * 100).toFixed(1)}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "text-xs font-semibold min-w-[46px] text-right",
                                    TONE_TEXT[tone]
                                  )}
                                >
                                  {(row.consumption_pct * 100).toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30 p-4">
                                <DailyHoursChart contractId={row.contract_id} month={month} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
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
