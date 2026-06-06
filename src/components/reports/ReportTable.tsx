"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export type ColumnDef = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

interface ReportTableProps {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  rows: Record<string, unknown>[];
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export default function ReportTable({
  columns,
  visibleColumns,
  rows,
  pagination,
  onPageChange,
  isLoading,
}: ReportTableProps) {
  const visible = columns.filter((c) => visibleColumns.has(c.key));

  const alignClass = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-muted-foreground">No data for selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visible.map((col) => (
                      <TableHead key={col.key} className={`whitespace-nowrap ${alignClass(col.align)}`}>
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {visible.map((col) => (
                        <TableCell key={col.key} className={alignClass(col.align)}>
                          {col.render
                            ? col.render(row[col.key], row)
                            : String(row[col.key] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
              <span className="text-sm text-muted-foreground">
                {pagination.total} row{pagination.total !== 1 ? "s" : ""} · Page {pagination.page} of {pagination.totalPages}
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => onPageChange(pagination.page - 1)}
                      aria-disabled={pagination.page <= 1}
                      className={pagination.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => onPageChange(pagination.page + 1)}
                      aria-disabled={pagination.page >= pagination.totalPages}
                      className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
