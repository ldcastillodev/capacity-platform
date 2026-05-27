"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportSquads, fetchSquads, type SquadReportRow } from "@/lib/client";
import { StatCard } from "@/components/StatCard";
import ReportTable, { type ColumnDef, type PaginationState } from "./ReportTable";
import ReportsFilterPanel from "./ReportsFilterPanel";
import ExportButton from "./ExportButton";

const fmt = (v: unknown, decimals = 1) =>
  v == null ? "—" : Number(v).toFixed(decimals);

const COLUMN_DEFS: ColumnDef[] = [
  { key: "squad_name",     label: "Squad" },
  { key: "month_label",    label: "Month" },
  { key: "capacity_hours", label: "Capacity h",  align: "right", render: (v) => fmt(v) + "h" },
  { key: "billable_hours", label: "Billable h",  align: "right", render: (v) => fmt(v) + "h" },
  { key: "nb_hours",       label: "NB h",        align: "right", render: (v) => fmt(v) + "h" },
  {
    key: "utilization",
    label: "Utilization",
    align: "right",
    render: (_v, row) => {
      const cap = Number(row.capacity_hours ?? 0);
      const bil = Number(row.billable_hours ?? 0);
      if (cap <= 0) return "—";
      const u = (bil / cap) * 100;
      const color = u > 100 ? "var(--critical)" : u > 90 ? "var(--warning)" : undefined;
      return <span style={{ color }}>{u.toFixed(1)}%</span>;
    },
  },
];

function toRow(r: SquadReportRow): Record<string, unknown> {
  return {
    ...r,
    month_label: new Date(r.month).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
    utilization: null,
  };
}

export type SquadFilters = {
  from: string;
  to: string;
  squadId: string;
  roleType: string;
};

function defaultSquadFilters(): SquadFilters {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from: def, to: def, squadId: "", roleType: "" };
}

export default function SquadsReport() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [filters, setFilters] = useState<SquadFilters>(defaultSquadFilters);
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(COLUMN_DEFS.map((c) => c.key))
  );
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-squads", filters, page],
    queryFn: () =>
      fetchReportSquads({
        from: filters.from || undefined,
        to: filters.to || undefined,
        squadId: filters.squadId ? Number(filters.squadId) : undefined,
        roleType: filters.roleType || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: queryEnabled,
  });

  const { data: squadOptions } = useQuery({ queryKey: ["squads"], queryFn: fetchSquads });

  const rows = (data?.data ?? []).map(toRow);

  const totalCapacity = rows.reduce((s, r) => s + Number(r.capacity_hours ?? 0), 0);
  const totalBillable = rows.reduce((s, r) => s + Number(r.billable_hours ?? 0), 0);
  const totalNb       = rows.reduce((s, r) => s + Number(r.nb_hours       ?? 0), 0);
  const avgUtil =
    rows.length > 0
      ? rows.reduce((s, row) => {
          const cap = Number(row.capacity_hours ?? 0);
          const bil = Number(row.billable_hours ?? 0);
          return s + (cap > 0 ? bil / cap : 0);
        }, 0) / rows.length
      : 0;

  const pagination: PaginationState = {
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? PAGE_SIZE,
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
  };

  function handleApply(f: SquadFilters) {
    setFilters(f);
    setQueryEnabled(true);
    setPage(1);
  }

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function fetchAllForExport() {
    const result = await fetchReportSquads({
      from: filters.from || undefined,
      to: filters.to || undefined,
      squadId: filters.squadId ? Number(filters.squadId) : undefined,
      roleType: filters.roleType || undefined,
      page: 1,
      pageSize: 10000,
    });
    return result.data.map(toRow);
  }

  if (!queryEnabled) {
    return (
      <ReportEmptyState
        onConfigure={() => setPanelOpen(true)}
        panel={
          <ReportsFilterPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            type="squads"
            initialFilters={filters}
            onApply={handleApply}
            columnDefs={COLUMN_DEFS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            squadOptions={(squadOptions ?? []).map((s) => ({ id: s.id, name: s.name }))}
            clientOptions={[]}
          />
        }
      />
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Capacity" value={totalCapacity.toFixed(1) + "h"} />
        <StatCard label="Total Billable" value={totalBillable.toFixed(1) + "h"} />
        <StatCard label="Total NB"       value={totalNb.toFixed(1) + "h"} />
        <StatCard label="Avg Utilization" value={(avgUtil * 100).toFixed(1) + "%"} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setPanelOpen(true)}
          style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          Filters &amp; Columns
        </button>
        <ExportButton
          fetchAll={fetchAllForExport}
          columnDefs={COLUMN_DEFS}
          visibleColumns={visibleColumns}
          filename={`report-squads-${filters.from}-${filters.to}`}
        />
      </div>

      <ReportTable
        columns={COLUMN_DEFS}
        visibleColumns={visibleColumns}
        rows={rows}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <ReportsFilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        type="squads"
        initialFilters={filters}
        onApply={handleApply}
        columnDefs={COLUMN_DEFS}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        squadOptions={(squadOptions ?? []).map((s) => ({ id: s.id, name: s.name }))}
        clientOptions={[]}
      />
    </div>
  );
}

function ReportEmptyState({ onConfigure, panel }: { onConfigure: () => void; panel: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "80px 32px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32 }}>📊</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
            No report generated yet
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Select a date range and apply filters to generate the report.
          </div>
        </div>
        <button
          onClick={onConfigure}
          style={{
            padding: "9px 24px",
            borderRadius: 8,
            border: "none",
            background: "var(--primary)",
            color: "#FDFDFD",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Configure Report
        </button>
      </div>
      {panel}
    </div>
  );
}
