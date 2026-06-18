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
import type { ReportDimension, ReportRow } from "@/lib/client";
import { roleLabel, DIMENSION_LABELS } from "./roleLabels";
import ExportButton, { type ExportColumn } from "./ExportButton";
import { formatHours } from "@/lib/utils/formatting";

type SortKey = `dim:${ReportDimension}` | "billableHours" | "nonBillableHours";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function dimCell(row: ReportRow, dim: ReportDimension): string {
  const raw = row.labels[dim] ?? "";
  if (dim === "role") return roleLabel(raw === "unassigned" ? null : raw);
  if (dim === "month") return monthLabel(raw);
  if (dim === "week" || dim === "day") return dateLabel(raw);
  return raw;
}

interface Props {
  rows: ReportRow[];
  dimensions: ReportDimension[];
  filename: string;
}

export function ReportDataTable({ rows, dimensions, filename }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(`dim:${dimensions[0]}`);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  // Selected dimensions can change under us — keep the sort key valid by adjusting
  // state during render (React re-renders immediately, no cascading effect).
  const dimsKey = dimensions.join(",");
  const [prevDimsKey, setPrevDimsKey] = useState(dimsKey);
  if (dimsKey !== prevDimsKey) {
    setPrevDimsKey(dimsKey);
    if (sortKey.startsWith("dim:") && !dimensions.includes(sortKey.slice(4) as ReportDimension)) {
      setSortKey(`dim:${dimensions[0]}`);
      setSortDir("asc");
      setPage(1);
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey.startsWith("dim:")) {
        const dim = sortKey.slice(4) as ReportDimension;
        // Sort temporal dimensions by their ISO value, not the display label
        av =
          dim === "month" || dim === "week" || dim === "day"
            ? (a.labels[dim] ?? "")
            : dimCell(a, dim);
        bv =
          dim === "month" || dim === "week" || dim === "day"
            ? (b.labels[dim] ?? "")
            : dimCell(b, dim);
      } else {
        const k = sortKey as "billableHours" | "nonBillableHours";
        av = a[k];
        bv = b[k];
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key.startsWith("dim:") ? "asc" : "desc");
    }
    setPage(1);
  }

  const exportColumns: ExportColumn[] = [
    ...dimensions.map((d) => ({ key: d, label: DIMENSION_LABELS[d] })),
    { key: "billableHours", label: "Billable h" },
    { key: "nonBillableHours", label: "Non-Billable h" },
  ];

  const exportRows = () =>
    Promise.resolve(
      sorted.map((r) => {
        const out: Record<string, string> = {};
        for (const d of dimensions) out[d] = dimCell(r, d);
        out.billableHours = r.billableHours.toFixed(1);
        out.nonBillableHours = r.nonBillableHours.toFixed(1);
        return out;
      })
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "row" : "rows"}
        </p>
        <ExportButton
          fetchAll={exportRows}
          columnDefs={exportColumns}
          visibleColumns={new Set(exportColumns.map((c) => c.key))}
          filename={filename}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {dimensions.map((d) => (
                <SortHead
                  key={d}
                  label={DIMENSION_LABELS[d]}
                  active={sortKey === `dim:${d}`}
                  dir={sortDir}
                  onClick={() => toggleSort(`dim:${d}`)}
                />
              ))}
              <SortHead
                label="Billable"
                align="right"
                active={sortKey === "billableHours"}
                dir={sortDir}
                onClick={() => toggleSort("billableHours")}
              />
              <SortHead
                label="Non-Billable"
                align="right"
                active={sortKey === "nonBillableHours"}
                dir={sortDir}
                onClick={() => toggleSort("nonBillableHours")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={dimensions.length + 2}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No hours for the selected filters
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow key={r.key}>
                {dimensions.map((d, i) => (
                  <TableCell key={d} className={i === 0 ? "font-medium" : undefined}>
                    {dimCell(r, d)}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">
                  {formatHours(r.billableHours)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatHours(r.nonBillableHours)}
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
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >
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
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
