"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchReportHours, fetchReportFilters, type ReportFilterParams } from "@/lib/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportFilters, type ReportFilterState } from "./ReportFilters";
import { ReportKpis } from "./ReportKpis";
import { ReportChart } from "./ReportChart";
import { ReportDataTable } from "./ReportDataTable";
import type { GroupBy, Billability } from "./roleLabels";

const GROUP_BYS: GroupBy[] = ["person", "squad", "client", "contract", "role", "month"];
const BILLABILITIES: Billability[] = ["all", "billable", "nonbillable"];

function defaultState(): ReportFilterState {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(from),
    to: iso(to),
    groupBy: "squad",
    billability: "all",
    personIds: [],
    squadIds: [],
    clientIds: [],
    contractIds: [],
    sowIds: [],
    roleTypes: [],
  };
}

function ids(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(Number.isFinite);
}

function parseState(params: URLSearchParams): ReportFilterState {
  const d = defaultState();
  const groupByParam = params.get("groupBy") as GroupBy | null;
  const billabilityParam = params.get("billability") as Billability | null;
  return {
    from: params.get("from") || d.from,
    to: params.get("to") || d.to,
    groupBy: groupByParam && GROUP_BYS.includes(groupByParam) ? groupByParam : d.groupBy,
    billability: billabilityParam && BILLABILITIES.includes(billabilityParam) ? billabilityParam : d.billability,
    personIds: ids(params.get("personIds")),
    squadIds: ids(params.get("squadIds")),
    clientIds: ids(params.get("clientIds")),
    contractIds: ids(params.get("contractIds")),
    sowIds: ids(params.get("sowIds")),
    roleTypes: (params.get("roleTypes") || "").split(",").filter(Boolean),
  };
}

function stateToParams(s: ReportFilterState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("from", s.from);
  p.set("to", s.to);
  p.set("groupBy", s.groupBy);
  p.set("billability", s.billability);
  if (s.personIds.length) p.set("personIds", s.personIds.join(","));
  if (s.squadIds.length) p.set("squadIds", s.squadIds.join(","));
  if (s.clientIds.length) p.set("clientIds", s.clientIds.join(","));
  if (s.contractIds.length) p.set("contractIds", s.contractIds.join(","));
  if (s.sowIds.length) p.set("sowIds", s.sowIds.join(","));
  if (s.roleTypes.length) p.set("roleTypes", s.roleTypes.join(","));
  return p;
}

export function ReportBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseState(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: ReportFilterState) => {
      router.replace(`?${stateToParams(next).toString()}`, { scroll: false });
    },
    [router]
  );

  const onChange = useCallback(
    (patch: Partial<ReportFilterState>) => setFilters({ ...filters, ...patch }),
    [filters, setFilters]
  );

  const onReset = useCallback(() => setFilters(defaultState()), [setFilters]);

  const { data: options } = useQuery({
    queryKey: ["report-filter-options"],
    queryFn: fetchReportFilters,
  });

  const queryParams: ReportFilterParams = filters;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["report-hours", filters],
    queryFn: () => fetchReportHours(queryParams),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <ReportFilters filters={filters} onChange={onChange} onReset={onReset} options={options} />

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Failed to load report. Adjust filters and try again.
        </div>
      ) : isLoading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-64" />
        </div>
      ) : data ? (
        <>
          <ReportKpis kpis={data.kpis} />
          <ReportChart series={data.series} />
          <ReportDataTable
            rows={data.rows}
            groupBy={data.groupBy}
            filename={`report-${filters.groupBy}-${filters.from}-${filters.to}`}
          />
        </>
      ) : null}
    </div>
  );
}
