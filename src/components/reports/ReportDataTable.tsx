"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportGroupBy, ReportRow } from "@/lib/client";
import { roleLabel, GROUP_BY_LABELS } from "./roleLabels";
import ExportButton, { type ExportColumn } from "./ExportButton";

type SortKey = "label" | "month" | "billableHours" | "nonBillableHours" | "plannedHours" | "utilizationPct";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

function groupLabel(row: ReportRow, groupBy: ReportGroupBy): string {
  if (groupBy === "role") return roleLabel(row.label);
  if (groupBy === "month") return monthLabel(row.label);
  return row.label;
}

const h = (v: number) => `${v.toFixed(1)}h`;

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "label", label: "Group" },
  { key: "month", label: "Month" },
  { key: "billableHours", label: "Billable h" },
  { key: "nonBillableHours", label: "Non-Billable h" },
  { key: "plannedHours", label: "Planned h" },
  { key: "utilizationPct", label: "Utilization" },
];

interface Props {
  rows: ReportRow[];
  groupBy: ReportGroupBy;
  filename: string;
}

export function ReportDataTable({ rows, groupBy, filename }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "label") {
        av = groupLabel(a, groupBy);
        bv = groupLabel(b, groupBy);
      } else if (sortKey === "month") {
        av = a.month;
        bv = b.month;
      } else {
        av = a[sortKey] ?? -1;
        bv = b[sortKey] ?? -1;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir, groupBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "label" || key === "month" ? "asc" : "desc");
    }
    setPage(1);
  }

  function utilColor(util: number | null): string | undefined {
    if (util == null) return undefined;
    if (util > 1.0) return "var(--critical)";
    if (util > 0.9) return "var(--warning)";
    return "var(--safe)";
  }

  const exportRows = () =>
    Promise.resolve(
      sorted.map((r) => ({
        label: groupLabel(r, groupBy),
        month: monthLabel(r.month),
        billableHours: r.billableHours.toFixed(1),
        nonBillableHours: r.nonBillableHours.toFixed(1),
        plannedHours: r.plannedHours == null ? "" : r.plannedHours.toFixed(1),
        utilizationPct: r.utilizationPct == null ? "" : `${(r.utilizationPct * 100).toFixed(1)}%`,
      }))
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "row" : "rows"}
        </p>
        <ExportButton
          fetchAll={exportRows}
          columnDefs={EXPORT_COLUMNS}
          visibleColumns={new Set(EXPORT_COLUMNS.map((c) => c.key))}
          filename={filename}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label={GROUP_BY_LABELS[groupBy]} active={sortKey === "label"} dir={sortDir} onClick={() => toggleSort("label")} />
              <SortHead label="Month" active={sortKey === "month"} dir={sortDir} onClick={() => toggleSort("month")} />
              <SortHead label="Billable" align="right" active={sortKey === "billableHours"} dir={sortDir} onClick={() => toggleSort("billableHours")} />
              <SortHead label="Non-Billable" align="right" active={sortKey === "nonBillableHours"} dir={sortDir} onClick={() => toggleSort("nonBillableHours")} />
              <SortHead label="Planned" align="right" active={sortKey === "plannedHours"} dir={sortDir} onClick={() => toggleSort("plannedHours")} />
              <SortHead label="Utilization" align="right" active={sortKey === "utilizationPct"} dir={sortDir} onClick={() => toggleSort("utilizationPct")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No hours for the selected filters
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{groupLabel(r, groupBy)}</TableCell>
                <TableCell>{monthLabel(r.month)}</TableCell>
                <TableCell className="text-right tabular-nums">{h(r.billableHours)}</TableCell>
                <TableCell className="text-right tabular-nums">{h(r.nonBillableHours)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.plannedHours == null ? "—" : h(r.plannedHours)}
                </TableCell>
                <TableCell
                  className="text-right tabular-nums font-medium"
                  style={{ color: utilColor(r.utilizationPct) }}
                >
                  {r.utilizationPct == null ? "—" : `${(r.utilizationPct * 100).toFixed(1)}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function SortHead({
  label,
  align = "left",
  active,
  dir,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
