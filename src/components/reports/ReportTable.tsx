"use client";

import React from "react";

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

const thStyle: React.CSSProperties = {
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg)",
  whiteSpace: "nowrap",
};

export default function ReportTable({
  columns,
  visibleColumns,
  rows,
  pagination,
  onPageChange,
  isLoading,
}: ReportTableProps) {
  const visible = columns.filter((c) => visibleColumns.has(c.key));

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {isLoading ? (
        <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ padding: 24, color: "var(--text-muted)" }}>
          No data for selected period.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr>
              {visible.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...thStyle,
                    textAlign: col.align ?? "left",
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "var(--surface)" : "var(--bg)",
                }}
              >
                {visible.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "11px 14px",
                      fontSize: 14,
                      textAlign: col.align ?? "left",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {!isLoading && pagination.total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {pagination.total} row{pagination.total !== 1 ? "s" : ""} · Page{" "}
            {pagination.page} of {pagination.totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13,
                cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                color:
                  pagination.page <= 1 ? "var(--text-muted)" : "var(--text)",
              }}
            >
              Prev
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13,
                cursor:
                  pagination.page >= pagination.totalPages
                    ? "not-allowed"
                    : "pointer",
                color:
                  pagination.page >= pagination.totalPages
                    ? "var(--text-muted)"
                    : "var(--text)",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
