"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

type SubTab = "sync-logs";

const thStyle: React.CSSProperties = {
  padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 12,
  color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
  background: "var(--bg)", whiteSpace: "nowrap",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 6,
  border: "1px solid var(--border)", fontSize: 14,
  background: "var(--surface)", color: "var(--text)", outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontWeight: 500, fontSize: 13 };
function fmt(v: string | null | undefined) { return v ? v.split("T")[0] : "—"; }
function nullDash(v: unknown) { return v == null ? "—" : String(v); }

interface SyncLogRow {
  id: number;
  source: string;
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  recordsFetched: number | null;
  recordsCreated: number | null;
  recordsSkipped: number | null;
  recordsConflicted: number | null;
}

function SyncLogsSection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ source: string }>({ source: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sync-logs", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.source) params.source = submitted.source;
      return api.get<SyncLogRow[]>("/management/sync-logs", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ source: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Source</label>
          <input style={{ ...inputStyle, width: 200 }} type="text" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="e.g. jira" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Started</th>
                <th style={thStyle}>Completed</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Fetched</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Created</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Skipped</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Conflicted</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500 }}>{row.source}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.startedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.completedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsFetched)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsCreated)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsSkipped)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsConflicted)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

export function AuditTab() {
  return (
    <div>
      <SyncLogsSection />
    </div>
  );
}
