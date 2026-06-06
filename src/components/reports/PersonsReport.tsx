"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportPersons, fetchSquads, type PersonReportRow } from "@/lib/client";
import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import ReportTable, { type ColumnDef, type PaginationState } from "./ReportTable";
import ReportsFilterPanel from "./ReportsFilterPanel";
import ExportButton from "./ExportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";

const fmt = (v: unknown, decimals = 1) => v == null ? "—" : Number(v).toFixed(decimals);
const pct = (v: unknown) => v == null ? "—" : (Number(v) * 100).toFixed(1) + "%";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "person_name",     label: "Person" },
  { key: "squad_name",      label: "Squad" },
  { key: "employment_type", label: "Type" },
  { key: "month_label",     label: "Month" },
  { key: "capacity_hours",  label: "Capacity h",  align: "right", render: (v) => fmt(v) + "h" },
  { key: "billable_hours",  label: "Billable h",  align: "right", render: (v) => fmt(v) + "h" },
  { key: "nb_hours",        label: "NB h",        align: "right", render: (v) => fmt(v) + "h" },
  { key: "nb_pct",          label: "NB %",        align: "right", render: (v) => pct(v) },
  {
    key: "utilization", label: "Utilization", align: "right",
    render: (_v, row) => {
      const cap = Number(row.capacity_hours ?? 0);
      const bil = Number(row.billable_hours ?? 0);
      if (cap <= 0) return "—";
      return ((bil / cap) * 100).toFixed(1) + "%";
    },
  },
];

function toRow(r: PersonReportRow): Record<string, unknown> {
  return { ...r, month_label: new Date(r.month).toLocaleDateString("en-US", { year: "numeric", month: "short" }), utilization: null };
}

export type PersonFilters = { from: string; to: string; squadId: string; };

function defaultPersonFilters(): PersonFilters {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from: def, to: def, squadId: "" };
}

export default function PersonsReport() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [filters, setFilters] = useState<PersonFilters>(defaultPersonFilters);
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_DEFS.map((c) => c.key)));
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-persons", filters, page],
    queryFn: () => fetchReportPersons({
      from: filters.from || undefined, to: filters.to || undefined,
      squadId: filters.squadId ? Number(filters.squadId) : undefined, page, pageSize: PAGE_SIZE,
    }),
    enabled: queryEnabled,
  });

  const { data: squadOptions } = useQuery({ queryKey: ["squads"], queryFn: fetchSquads });
  const rows = (data?.data ?? []).map(toRow);

  const totalBillable = rows.reduce((s, r) => s + Number(r.billable_hours ?? 0), 0);
  const totalNb = rows.reduce((s, r) => s + Number(r.nb_hours ?? 0), 0);
  const avgNbPct = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.nb_pct ?? 0), 0) / rows.length : 0;
  const avgUtil = rows.length > 0 ? rows.reduce((s, row) => {
    const cap = Number(row.capacity_hours ?? 0); const bil = Number(row.billable_hours ?? 0);
    return s + (cap > 0 ? bil / cap : 0);
  }, 0) / rows.length : 0;

  const pagination: PaginationState = {
    page: data?.page ?? 1, pageSize: data?.pageSize ?? PAGE_SIZE,
    total: data?.total ?? 0, totalPages: data?.totalPages ?? 1,
  };

  function handleApply(f: PersonFilters) { setFilters(f); setQueryEnabled(true); setPage(1); }
  function toggleColumn(key: string) {
    setVisibleColumns((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  async function fetchAllForExport() {
    const result = await fetchReportPersons({
      from: filters.from || undefined, to: filters.to || undefined,
      squadId: filters.squadId ? Number(filters.squadId) : undefined, page: 1, pageSize: 10000,
    });
    return result.data.map(toRow);
  }

  const filterPanel = (
    <ReportsFilterPanel
      open={panelOpen} onClose={() => setPanelOpen(false)}
      type="persons" initialFilters={filters} onApply={handleApply}
      columnDefs={COLUMN_DEFS} visibleColumns={visibleColumns} onToggleColumn={toggleColumn}
      squadOptions={(squadOptions ?? []).map((s) => ({ id: s.id, name: s.name }))}
      clientOptions={[]}
    />
  );

  if (!queryEnabled) {
    return (
      <>
        <ReportEmptyState onConfigure={() => setPanelOpen(true)} />
        {filterPanel}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <MetricCardGrid>
        <StatCard label="Total Billable" value={totalBillable.toFixed(1) + "h"} />
        <StatCard label="Total NB"       value={totalNb.toFixed(1) + "h"} />
        <StatCard label="Avg NB %" value={(avgNbPct * 100).toFixed(1) + "%"}
          valueColor={avgNbPct > 0.3 ? "var(--critical)" : avgNbPct > 0.2 ? "var(--warning)" : undefined} />
        <StatCard label="Avg Utilization" value={(avgUtil * 100).toFixed(1) + "%"} />
      </MetricCardGrid>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setPanelOpen(true)} className="gap-1.5">
          <SlidersHorizontal size={14} /> Filters &amp; Columns
        </Button>
        <ExportButton fetchAll={fetchAllForExport} columnDefs={COLUMN_DEFS} visibleColumns={visibleColumns} filename={`report-persons-${filters.from}-${filters.to}`} />
      </div>

      <ReportTable columns={COLUMN_DEFS} visibleColumns={visibleColumns} rows={rows} pagination={pagination} onPageChange={setPage} isLoading={isLoading} />
      {filterPanel}
    </div>
  );
}

function ReportEmptyState({ onConfigure }: { onConfigure: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-4xl">📊</div>
        <div>
          <p className="font-semibold text-base mb-1.5">No report generated yet</p>
          <p className="text-sm text-muted-foreground">Select a date range and apply filters to generate the report.</p>
        </div>
        <Button onClick={onConfigure}>Configure Report</Button>
      </CardContent>
    </Card>
  );
}
