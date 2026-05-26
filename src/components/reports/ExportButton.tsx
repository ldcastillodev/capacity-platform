"use client";

import React, { useState } from "react";
import type { ColumnDef } from "./ReportTable";

interface Props {
  fetchAll: () => Promise<Record<string, unknown>[]>;
  columnDefs: ColumnDef[];
  visibleColumns: Set<string>;
  filename: string;
}

export default function ExportButton({ fetchAll, columnDefs, visibleColumns, filename }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const rows = await fetchAll();
      const visible = columnDefs.filter((c) => visibleColumns.has(c.key));

      const sheetData = rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const col of visible) {
          const raw = row[col.key];
          out[col.label] = raw == null ? "" : String(raw);
        }
        return out;
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        padding: "7px 16px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: loading ? "var(--bg)" : "var(--primary)",
        color: loading ? "var(--text-muted)" : "#fff",
        fontSize: 13,
        fontWeight: 500,
        cursor: loading ? "not-allowed" : "pointer",
        transition: "background 0.15s",
      }}
    >
      {loading ? "Exporting…" : "Export XLSX"}
    </button>
  );
}
