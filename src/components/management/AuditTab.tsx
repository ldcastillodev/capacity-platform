"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

type SubTab = "declarations" | "amendments" | "extensions" | "change-orders" | "line-items" | "sme" | "sync-logs";

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
function subTabBtn(active: boolean): React.CSSProperties {
  return { padding: "7px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`, marginBottom: -1, borderRadius: 0 };
}
function fmt(v: string | null | undefined) { return v ? v.split("T")[0] : "—"; }
function nullDash(v: unknown) { return v == null ? "—" : String(v); }

interface DeclarationHistoryRow {
  id: number;
  declarationId: number;
  changedAt: string;
  changedBy: number | null;
  prevStatus: string | null;
  newStatus: string | null;
  prevDeclaredHours: string | null;
  newDeclaredHours: string | null;
}

function DeclarationsHistorySection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ declarationId: string }>({ declarationId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-declarations", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.declarationId) params.declarationId = submitted.declarationId;
      return api.get<DeclarationHistoryRow[]>("/management/audit/declarations-history", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ declarationId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Declaration ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Declaration</th>
                <th style={thStyle}>Changed At</th>
                <th style={thStyle}>Changed By</th>
                <th style={thStyle}>Prev Status</th>
                <th style={thStyle}>New Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Hours</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.declarationId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.changedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{nullDash(row.changedBy)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.prevStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.newStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevDeclaredHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newDeclaredHours)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface ContractAmendmentRow {
  id: number;
  contractId: number;
  effectiveFrom: string;
  prevPoolHours: string | null;
  newPoolHours: string | null;
  reason: string | null;
  changedBy: number | null;
  createdAt: string;
}

function ContractAmendmentsSection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ contractId: string }>({ contractId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-amendments", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.contractId) params.contractId = submitted.contractId;
      return api.get<ContractAmendmentRow[]>("/management/audit/contract-amendments", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ contractId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Contract ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Contract</th>
                <th style={thStyle}>Effective From</th>
                <th style={thStyle}>Created At</th>
                <th style={thStyle}>Changed By</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Hours</th>
                <th style={thStyle}>Reason</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.contractId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.effectiveFrom)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.createdAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{nullDash(row.changedBy)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevPoolHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newPoolHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{nullDash(row.reason)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface ExtensionHistoryRow {
  id: number;
  extensionId: number;
  changedAt: string;
  changedBy: number | null;
  prevStatus: string | null;
  newStatus: string | null;
  prevRequestedHours: string | null;
  newRequestedHours: string | null;
}

function ExtensionsHistorySection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ extensionId: string }>({ extensionId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-extensions", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.extensionId) params.extensionId = submitted.extensionId;
      return api.get<ExtensionHistoryRow[]>("/management/audit/extensions-history", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ extensionId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Extension ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Extension</th>
                <th style={thStyle}>Changed At</th>
                <th style={thStyle}>Prev Status</th>
                <th style={thStyle}>New Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Hours</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.extensionId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.changedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.prevStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.newStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevRequestedHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newRequestedHours)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface ChangeOrderHistoryRow {
  id: number;
  changeOrderId: number;
  changedAt: string;
  changedBy: number | null;
  prevStatus: string | null;
  newStatus: string | null;
  prevNotes: string | null;
}

function ChangeOrderHistorySection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ changeOrderId: string }>({ changeOrderId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-change-orders", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.changeOrderId) params.changeOrderId = submitted.changeOrderId;
      return api.get<ChangeOrderHistoryRow[]>("/management/audit/change-order-history", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ changeOrderId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Change Order ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>CO</th>
                <th style={thStyle}>Changed At</th>
                <th style={thStyle}>Prev Status</th>
                <th style={thStyle}>New Status</th>
                <th style={thStyle}>Notes</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.changeOrderId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.changedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.prevStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.newStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nullDash(row.prevNotes)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface LineItemHistoryRow {
  id: number;
  lineItemId: number;
  changedAt: string;
  changedBy: number | null;
  prevHours: string | null;
  newHours: string | null;
  prevRateOverride: string | null;
  newRateOverride: string | null;
}

function LineItemHistorySection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ lineItemId: string }>({ lineItemId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-line-items", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.lineItemId) params.lineItemId = submitted.lineItemId;
      return api.get<LineItemHistoryRow[]>("/management/audit/line-item-history", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ lineItemId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Line Item ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Line Item</th>
                <th style={thStyle}>Changed At</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Rate</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Rate</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.lineItemId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.changedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newHours)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevRateOverride)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newRateOverride)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface SMEHistoryRow {
  id: number;
  engagementId: number;
  changedAt: string;
  changedBy: number | null;
  prevStatus: string | null;
  newStatus: string | null;
  prevBillingRate: string | null;
  newBillingRate: string | null;
  prevCostRate: string | null;
  newCostRate: string | null;
}

function SMEHistorySection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ engagementId: string }>({ engagementId: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sme", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.engagementId) params.engagementId = submitted.engagementId;
      return api.get<SMEHistoryRow[]>("/management/audit/sme-history", { params }).then(r => r.data);
    },
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ engagementId: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Engagement ID</label>
          <input style={{ ...inputStyle, width: 160 }} type="number" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="Optional" />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Engagement</th>
                <th style={thStyle}>Changed At</th>
                <th style={thStyle}>Prev Status</th>
                <th style={thStyle}>New Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prev Billing Rate</th>
                <th style={{ ...thStyle, textAlign: "right" }}>New Billing Rate</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.id}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.engagementId}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.changedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.prevStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{nullDash(row.newStatus)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.prevBillingRate)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.newBillingRate)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

interface SyncLogRow {
  id: number;
  source: string;
  syncType: string;
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  recordsFetched: number | null;
  recordsCreated: number | null;
  recordsSkipped: number | null;
  recordsConflicted: number | null;
  errorMessage: string | null;
  unmappedRefs: unknown;
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

  function unmappedDisplay(v: unknown): string {
    if (v == null) return "—";
    if (Array.isArray(v)) return String(v.length);
    const s = String(v);
    return s.length > 40 ? s.slice(0, 40) + "…" : s;
  }

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setSubmitted({ source: filterInput }); }} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={labelStyle}>Source</label>
          <input style={{ ...inputStyle, width: 200 }} type="text" value={filterInput} onChange={e => setFilterInput(e.target.value)} placeholder="e.g. tempo, jira" />
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
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Started</th>
                <th style={thStyle}>Completed</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Fetched</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Created</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Skipped</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Conflicted</th>
                <th style={thStyle}>Error</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500 }}>{row.source}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.syncType}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.startedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmt(row.completedAt)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsFetched)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsCreated)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsSkipped)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{nullDash(row.recordsConflicted)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: row.errorMessage ? "var(--critical)" : "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.errorMessage ?? unmappedDisplay(row.unmappedRefs)}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

export function AuditTab() {
  const [sub, setSub] = useState<SubTab>("declarations");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "declarations", label: "Declarations" },
    { id: "amendments", label: "Amendments" },
    { id: "extensions", label: "Extensions" },
    { id: "change-orders", label: "Change Orders" },
    { id: "line-items", label: "Line Items" },
    { id: "sme", label: "SME" },
    { id: "sync-logs", label: "Sync Logs" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24, flexWrap: "wrap" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>
        ))}
      </div>
      {sub === "declarations" && <DeclarationsHistorySection />}
      {sub === "amendments" && <ContractAmendmentsSection />}
      {sub === "extensions" && <ExtensionsHistorySection />}
      {sub === "change-orders" && <ChangeOrderHistorySection />}
      {sub === "line-items" && <LineItemHistorySection />}
      {sub === "sme" && <SMEHistorySection />}
      {sub === "sync-logs" && <SyncLogsSection />}
    </div>
  );
}
