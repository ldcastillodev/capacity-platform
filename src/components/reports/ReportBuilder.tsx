"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchReportHours,
  fetchReportFilters,
  type ReportDimension,
  type ReportFilterParams,
  type ReportFilterOptions,
  type ReportGranularity,
} from "@/lib/client";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthRange } from "@/lib/temporal";
import { ReportFilters, type ReportFilterState } from "./ReportFilters";
import { ReportKpis } from "./ReportKpis";
import { ReportDataTable } from "./ReportDataTable";
import { DIMENSION_LABELS, type Billability } from "./roleLabels";

const GRANULARITIES: ReportGranularity[] = ["day", "week", "month"];
const BILLABILITIES: Billability[] = ["all", "billable", "nonbillable"];

function defaultState(): ReportFilterState {
  const now = new Date();
  const { start: from, end: to } = getMonthRange(now);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(from),
    to: iso(to),
    dimensions: ["squad"],
    granularity: "month",
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

function parseDimensions(raw: string | null): ReportDimension[] {
  const valid = (raw ?? "").split(",").filter((s): s is ReportDimension => s in DIMENSION_LABELS);
  const deduped = [...new Set(valid)];
  return deduped.length > 0 ? deduped : ["squad"];
}

function parseState(params: URLSearchParams): ReportFilterState {
  const d = defaultState();
  const granularityParam = params.get("granularity") as ReportGranularity | null;
  const billabilityParam = params.get("billability") as Billability | null;
  return {
    from: params.get("from") || d.from,
    to: params.get("to") || d.to,
    dimensions: parseDimensions(params.get("dimensions")),
    granularity:
      granularityParam && GRANULARITIES.includes(granularityParam)
        ? granularityParam
        : d.granularity,
    billability:
      billabilityParam && BILLABILITIES.includes(billabilityParam)
        ? billabilityParam
        : d.billability,
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
  p.set("dimensions", s.dimensions.join(","));
  p.set("granularity", s.granularity);
  p.set("billability", s.billability);
  if (s.personIds.length) p.set("personIds", s.personIds.join(","));
  if (s.squadIds.length) p.set("squadIds", s.squadIds.join(","));
  if (s.clientIds.length) p.set("clientIds", s.clientIds.join(","));
  if (s.contractIds.length) p.set("contractIds", s.contractIds.join(","));
  if (s.sowIds.length) p.set("sowIds", s.sowIds.join(","));
  if (s.roleTypes.length) p.set("roleTypes", s.roleTypes.join(","));
  return p;
}

// Drop child selections that fall outside the narrowed option sets after a
// parent filter change (squad → person, client/sow → sow/contract).
function pruneChildren(next: ReportFilterState, options: ReportFilterOptions): ReportFilterState {
  const out = { ...next };
  if (out.squadIds.length && out.personIds.length) {
    const squadSel = new Set(out.squadIds);
    const allowed = new Set(
      options.persons.filter((p) => p.squadIds.some((id) => squadSel.has(id))).map((p) => p.id)
    );
    out.personIds = out.personIds.filter((id) => allowed.has(id));
  }
  if (out.clientIds.length && out.sowIds.length) {
    const clientSel = new Set(out.clientIds);
    const allowed = new Set(options.sows.filter((s) => clientSel.has(s.clientId)).map((s) => s.id));
    out.sowIds = out.sowIds.filter((id) => allowed.has(id));
  }
  if ((out.clientIds.length || out.sowIds.length) && out.contractIds.length) {
    const sowClientById = new Map(options.sows.map((s) => [s.id, s.clientId]));
    const clientSel = new Set(out.clientIds);
    const sowSel = new Set(out.sowIds);
    const allowed = new Set(
      options.contracts
        .filter((c) => {
          if (out.sowIds.length && !sowSel.has(c.sowId)) return false;
          if (out.clientIds.length) {
            const clientId = sowClientById.get(c.sowId);
            if (clientId == null || !clientSel.has(clientId)) return false;
          }
          return true;
        })
        .map((c) => c.id)
    );
    out.contractIds = out.contractIds.filter((id) => allowed.has(id));
  }
  return out;
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

  const { data: options } = useQuery({
    queryKey: ["report-filter-options"],
    queryFn: fetchReportFilters,
  });

  const onChange = useCallback(
    (patch: Partial<ReportFilterState>) => {
      let next = { ...filters, ...patch };
      if (next.dimensions.length === 0) next.dimensions = ["squad"];
      if (options) next = pruneChildren(next, options);
      setFilters(next);
    },
    [filters, setFilters, options]
  );

  const onReset = useCallback(() => setFilters(defaultState()), [setFilters]);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : data ? (
        <>
          <ReportKpis kpis={data.kpis} />
          <ReportDataTable
            rows={data.rows}
            dimensions={data.dimensions}
            filename={`report-${filters.dimensions.join("-")}-${filters.from}-${filters.to}`}
          />
        </>
      ) : null}
    </div>
  );
}
