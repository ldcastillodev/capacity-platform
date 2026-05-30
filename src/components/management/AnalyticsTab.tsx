"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";

type SubTab = "consumption" | "burn" | "staffing" | "anomalies" | "suggestions" | "nb-summaries";

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
const fieldStyle: React.CSSProperties = { marginBottom: 18 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 };

function subTabBtn(active: boolean): React.CSSProperties {
  return { padding: "7px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`, marginBottom: -1, borderRadius: 0 };
}

function errMsg(e: unknown) { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e); }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "var(--safe-bg)", color: "var(--safe)" },
  open: { bg: "var(--watch-bg)", color: "var(--watch)" },
  acknowledged: { bg: "var(--warning-bg)", color: "var(--warning)" },
  applied: { bg: "var(--safe-bg)", color: "var(--safe)" },
  dismissed: { bg: "var(--border)", color: "var(--text-muted)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "var(--border)", color: "var(--text-muted)" };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{status.replace(/_/g, " ")}</span>;
}

// ─── Consumption ──────────────────────────────────────────────────────────────

interface ConsumptionRow {
  id: number; clientId: number; month: string; roleType: string;
  declaredHours: string; consumedHours: string; remainingHours: string; utilizationPct: string;
  client: { id: number; name: string };
}

function ConsumptionSection() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-consumption"],
    queryFn: () => api.get<ConsumptionRow[]>("/management/analytics/consumption").then(r => r.data),
  });

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No consumption data found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Declared Hrs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Consumed Hrs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Remaining Hrs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Utilization %</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0, 7)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.roleType?.replace(/_/g, " ") ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.declaredHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.consumedHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.remainingHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row.utilizationPct ? (parseFloat(row.utilizationPct) * 100).toFixed(1) + "%" : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ─── Burn ─────────────────────────────────────────────────────────────────────

interface BurnRow {
  id: number; clientId: number; weekStart: string; roleType: string | null;
  cumulativeHours: string; expectedCumulative: string; burnRateRatio: string;
  projectedEomHours: string; poolHours: string; alertLevel: string;
  client: { id: number; name: string };
}

function BurnSection() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-burn"],
    queryFn: () => api.get<BurnRow[]>("/management/analytics/burn").then(r => r.data),
  });

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No burn snapshots found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Week</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Cumulative</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Expected</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Burn Ratio</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Proj EOM</th>
                <th style={thStyle}>Alert</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.weekStart.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.roleType ? row.roleType.replace(/_/g," ") : "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.cumulativeHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.expectedCumulative).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.burnRateRatio).toFixed(2)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.projectedEomHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{row.alertLevel}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ─── Staffing ─────────────────────────────────────────────────────────────────

interface StaffingRow {
  id: number; squadId: number; month: string; roleType: string;
  totalAvailableHours: string; committedHours: string; netGapHours: string;
  isUnderstaffed: boolean; isOverstaffed: boolean;
  squad: { id: number; name: string };
}

function StaffingSection() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-staffing"],
    queryFn: () => api.get<StaffingRow[]>("/management/analytics/staffing").then(r => r.data),
  });

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No staffing data found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Squad</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Available Hrs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Committed Hrs</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Net Gap</th>
                <th style={thStyle}>Status</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.squad.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0, 7)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.roleType?.replace(/_/g, " ") ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.totalAvailableHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.committedHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.netGapHours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{row.isUnderstaffed ? <span style={{ color: "var(--critical)" }}>Under</span> : row.isOverstaffed ? <span style={{ color: "var(--watch)" }}>Over</span> : <span style={{ color: "var(--safe)" }}>OK</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ─── Anomaly Flags ────────────────────────────────────────────────────────────

interface AnomalyRow {
  id: number; clientId: number; month: string; roleType: string | null;
  flagType: string; severity: string; explanation: string; detectedAt: string;
  resolvedAt: string | null; client: { id: number; name: string };
}

function AnomalyFlagsSection() {
  const qc = useQueryClient();
  const [resolveRow, setResolveRow] = useState<AnomalyRow | null>(null);
  const [resolveForm, setResolveForm] = useState({ resolved_by: "", resolution_notes: "" });
  const [resolveError, setResolveError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-anomaly-flags"],
    queryFn: () => api.get<AnomalyRow[]>("/management/analytics/anomaly-flags").then(r => r.data),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { resolved_by?: number; resolution_notes: string } }) =>
      api.post(`/management/analytics/anomaly-flags/${id}/resolve`, body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-anomaly-flags"] }); closeResolve(); },
    onError: (e: unknown) => setResolveError(errMsg(e)),
  });

  function openResolve(row: AnomalyRow) {
    setResolveRow(row);
    setResolveForm({ resolved_by: "", resolution_notes: "" });
    setResolveError(null);
  }

  function closeResolve() {
    setResolveRow(null);
    setResolveForm({ resolved_by: "", resolution_notes: "" });
    setResolveError(null);
  }

  function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveRow) return;
    if (!resolveForm.resolution_notes.trim()) { setResolveError("Resolution notes are required."); return; }
    const body: { resolved_by?: number; resolution_notes: string } = { resolution_notes: resolveForm.resolution_notes };
    if (resolveForm.resolved_by) body.resolved_by = Number(resolveForm.resolved_by);
    resolveMut.mutate({ id: resolveRow.id, body });
  }

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No anomaly flags found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Flag Type</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Explanation</th>
                <th style={thStyle}>Detected</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isResolved = row.resolvedAt !== null;
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0, 7)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.roleType ? row.roleType.replace(/_/g, " ") : "—"}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12 }}>{row.flagType.replace(/_/g, " ")}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12 }}>{row.severity}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)", maxWidth: 240 }} title={row.explanation}>
                      {row.explanation.length > 80 ? row.explanation.slice(0, 80) + "…" : row.explanation}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{row.detectedAt.split("T")[0]}</td>
                    <td style={{ padding: "11px 14px" }}>
                      {isResolved
                        ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--safe-bg)", color: "var(--safe)", whiteSpace: "nowrap" }}>Resolved</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--watch-bg)", color: "var(--watch)", whiteSpace: "nowrap" }}>Open</span>}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {!isResolved && (
                        <button
                          onClick={() => openResolve(row)}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--warning)", background: "var(--warning-bg)", color: "var(--warning)", fontSize: 12, cursor: "pointer" }}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      {resolveRow !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeResolve} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 440, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Resolve Anomaly Flag</div>
            {resolveError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{resolveError}</p>}
            <form onSubmit={handleResolve}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Resolved By (Person ID)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={resolveForm.resolved_by}
                  onChange={e => setResolveForm({ ...resolveForm, resolved_by: e.target.value })}
                  placeholder="Optional — person ID"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Resolution Notes *</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                  required
                  value={resolveForm.resolution_notes}
                  onChange={e => setResolveForm({ ...resolveForm, resolution_notes: e.target.value })}
                  placeholder="Describe how this was resolved…"
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={closeResolve} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={resolveMut.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--warning)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: resolveMut.isPending ? "not-allowed" : "pointer", opacity: resolveMut.isPending ? 0.7 : 1 }}>
                  {resolveMut.isPending ? "Resolving…" : "Confirm Resolve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

interface SuggestionRow {
  id: number; month: string; suggestionType: string; status: string;
  explanation: string; suggestedAction: string | null;
  person: { id: number; name: string } | null;
  squad: { id: number; name: string };
}

function SuggestionsSection() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-suggestions"],
    queryFn: () => api.get<SuggestionRow[]>("/management/analytics/suggestions").then(r => r.data),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/management/analytics/suggestions/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-suggestions"] }); },
  });

  const TERMINAL = ["applied", "dismissed"];

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No suggestions found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Squad</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Explanation</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isTerminal = TERMINAL.includes(row.status);
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.person?.name ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0, 7)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.suggestionType.replace(/_/g, " ")}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)", maxWidth: 240 }} title={row.explanation}>
                      {row.explanation.length > 80 ? row.explanation.slice(0, 80) + "…" : row.explanation}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isTerminal ? null : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {row.status === "open" && (
                            <button
                              onClick={() => statusMut.mutate({ id: row.id, status: "acknowledged" })}
                              disabled={statusMut.isPending}
                              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--watch)", background: "var(--watch-bg)", color: "var(--watch)", fontSize: 12, cursor: "pointer" }}
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            onClick={() => statusMut.mutate({ id: row.id, status: "applied" })}
                            disabled={statusMut.isPending}
                            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--safe)", background: "var(--safe-bg)", color: "var(--safe)", fontSize: 12, cursor: "pointer" }}
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => statusMut.mutate({ id: row.id, status: "dismissed" })}
                            disabled={statusMut.isPending}
                            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ─── NB Summaries ─────────────────────────────────────────────────────────────

interface NBSummaryRow {
  id: number; personId: number | null; squadId: number; month: string;
  categoryType: string; totalHours: string; nonbillablePct: string;
  person: { id: number; name: string } | null;
  squad: { id: number; name: string };
}

function NBSummariesSection() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-summaries"],
    queryFn: () => api.get<NBSummaryRow[]>("/management/analytics/nb-summaries").then(r => r.data),
  });

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No non-billable summary data found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Squad</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Category Type</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total Hours</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.person?.name ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0, 7)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.categoryType?.replace(/_/g," ") ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.totalHours).toFixed(1)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const [subTab, setSubTab] = useState<SubTab>("consumption");

  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {(["consumption", "burn", "staffing", "anomalies", "suggestions", "nb-summaries"] as SubTab[]).map(t => (
          <button key={t} style={subTabBtn(subTab === t)} onClick={() => setSubTab(t)}>
            {t === "consumption" ? "Consumption" : t === "burn" ? "Burn" : t === "staffing" ? "Staffing" : t === "anomalies" ? "Anomaly Flags" : t === "suggestions" ? "Suggestions" : "NB Summaries"}
          </button>
        ))}
      </div>
      {subTab === "consumption" && <ConsumptionSection />}
      {subTab === "burn" && <BurnSection />}
      {subTab === "staffing" && <StaffingSection />}
      {subTab === "anomalies" && <AnomalyFlagsSection />}
      {subTab === "suggestions" && <SuggestionsSection />}
      {subTab === "nb-summaries" && <NBSummariesSection />}
    </div>
  );
}
