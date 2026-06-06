"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportClients, fetchClients, type ClientReportRow } from "@/lib/client";
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
  { key: "client_name",    label: "Client" },
  { key: "month",          label: "Month" },
  { key: "roleType",       label: "Role" },
  { key: "declaredHours",  label: "Declared h",      align: "right", render: (v) => fmt(v) + "h" },
  { key: "consumedHours",  label: "Consumed h",      align: "right", render: (v) => fmt(v) + "h" },
  { key: "retainerHours",  label: "Retainer h",      align: "right", render: (v) => fmt(v) + "h" },
  { key: "teHours",        label: "T&E h",           align: "right", render: (v) => fmt(v) + "h" },
  { key: "coHours",        label: "CO h",            align: "right", render: (v) => fmt(v) + "h" },
  { key: "smeHours",       label: "SME h",           align: "right", render: (v) => fmt(v) + "h" },
  { key: "remainingHours", label: "Remaining h",     align: "right", render: (v) => fmt(v) + "h" },
  { key: "ceremonyHours",  label: "NB (Ceremony) h", align: "right", render: (v) => fmt(v) + "h" },
  { key: "utilizationPct", label: "Utilization",     align: "right", render: (v) => pct(v) },
  { key: "billedRevenue",  label: "Billed Rev",      align: "right", render: (v) => v == null ? "—" : "$" + fmt(v, 2) },
  { key: "directCost",     label: "Direct Cost",     align: "right", render: (v) => v == null ? "—" : "$" + fmt(v, 2) },
  { key: "grossMargin",    label: "Gross Margin",    align: "right", render: (v) => v == null ? "—" : "$" + fmt(v, 2) },
  { key: "grossMarginPct", label: "Margin %",        align: "right", render: (v) => v == null ? "—" : pct(v) },
];

type ClientRowWithCeremony = ClientReportRow & { ceremonyHours: number };

function toRow(r: ClientRowWithCeremony): Record<string, unknown> {
  return {
    ...r,
    client_name: r.client.name,
    month: new Date(r.month).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
    roleType: r.roleType ?? "All roles",
  };
}

export type ClientFilters = { from: string; to: string; clientId: string; roleType: string; };

function defaultClientFilters(): ClientFilters {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from: def, to: def, clientId: "", roleType: "" };
}

export default function ClientsReport() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [filters, setFilters] = useState<ClientFilters>(defaultClientFilters);
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_DEFS.map((c) => c.key)));
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-clients", filters, page],
    queryFn: () => fetchReportClients({
      from: filters.from || undefined, to: filters.to || undefined,
      clientId: filters.clientId ? Number(filters.clientId) : undefined,
      roleType: filters.roleType || undefined, page, pageSize: PAGE_SIZE,
    }),
    enabled: queryEnabled,
  });

  const { data: clientOptions } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const rows = (data?.data ?? []).map((r) => toRow(r as ClientRowWithCeremony));
  const totalDeclared  = rows.reduce((s, r) => s + Number(r.declaredHours  ?? 0), 0);
  const totalConsumed  = rows.reduce((s, r) => s + Number(r.consumedHours  ?? 0), 0);
  const totalRemaining = rows.reduce((s, r) => s + Number(r.remainingHours ?? 0), 0);
  const avgUtil = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.utilizationPct ?? 0), 0) / rows.length : 0;

  const pagination: PaginationState = {
    page: data?.page ?? 1, pageSize: data?.pageSize ?? PAGE_SIZE,
    total: data?.total ?? 0, totalPages: data?.totalPages ?? 1,
  };

  function handleApply(f: ClientFilters) { setFilters(f); setQueryEnabled(true); setPage(1); }
  function toggleColumn(key: string) {
    setVisibleColumns((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  async function fetchAllForExport() {
    const result = await fetchReportClients({
      from: filters.from || undefined, to: filters.to || undefined,
      clientId: filters.clientId ? Number(filters.clientId) : undefined,
      roleType: filters.roleType || undefined, page: 1, pageSize: 10000,
    });
    return (result.data as ClientRowWithCeremony[]).map(toRow);
  }

  const filterPanel = (
    <ReportsFilterPanel
      open={panelOpen} onClose={() => setPanelOpen(false)}
      type="clients" initialFilters={filters} onApply={handleApply}
      columnDefs={COLUMN_DEFS} visibleColumns={visibleColumns} onToggleColumn={toggleColumn}
      clientOptions={(clientOptions ?? []).map((c) => ({ id: c.id, name: c.name }))}
      squadOptions={[]}
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
        <StatCard label="Total Declared"  value={totalDeclared.toFixed(1)  + "h"} />
        <StatCard label="Total Consumed"  value={totalConsumed.toFixed(1)  + "h"} />
        <StatCard label="Total Remaining" value={totalRemaining.toFixed(1) + "h"} />
        <StatCard
          label="Avg Utilization"
          value={(avgUtil * 100).toFixed(1) + "%"}
          valueColor={avgUtil > 1.0 ? "var(--critical)" : avgUtil > 0.9 ? "var(--warning)" : undefined}
        />
      </MetricCardGrid>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setPanelOpen(true)} className="gap-1.5">
          <SlidersHorizontal size={14} /> Filters &amp; Columns
        </Button>
        <ExportButton fetchAll={fetchAllForExport} columnDefs={COLUMN_DEFS} visibleColumns={visibleColumns} filename={`report-clients-${filters.from}-${filters.to}`} />
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
