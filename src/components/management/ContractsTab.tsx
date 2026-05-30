"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";

type SubTab = "retainer" | "extensions" | "change-orders" | "sme" | "declarations";

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
  return {
    padding: "7px 16px", border: "none", background: "transparent", fontSize: 13,
    fontWeight: active ? 600 : 400, color: active ? "var(--primary)" : "var(--text-muted)",
    cursor: "pointer", borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
    marginBottom: -1, borderRadius: 0,
  };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:           { bg: "var(--safe-bg)",     color: "var(--safe)" },
  confirmed:        { bg: "var(--safe-bg)",     color: "var(--safe)" },
  approved:         { bg: "var(--safe-bg)",     color: "var(--safe)" },
  paused:           { bg: "var(--watch-bg)",    color: "var(--watch)" },
  pending_approval: { bg: "var(--watch-bg)",    color: "var(--watch)" },
  pending_written:  { bg: "var(--watch-bg)",    color: "var(--watch)" },
  pending_docusign: { bg: "var(--warning-bg)",  color: "var(--warning)" },
  requested:        { bg: "var(--warning-bg)",  color: "var(--warning)" },
  draft:            { bg: "var(--warning-bg)",  color: "var(--warning)" },
  closed:           { bg: "var(--border)",      color: "var(--text-muted)" },
  rejected:         { bg: "var(--critical-bg)", color: "var(--critical)" },
  locked:           { bg: "var(--border)",      color: "var(--text-muted)" },
  derived:          { bg: "var(--border)",      color: "var(--text-muted)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "var(--border)", color: "var(--text-muted)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

const ROLE_TYPES = ["frontend_dev","backend_dev","fullstack_dev","devops","qa","ux_designer","product_manager","project_manager","tech_lead","solutions_architect","data_engineer","scrum_master","business_analyst","seo","content_author","client_services"];

interface ClientOption { id: number; name: string }
interface SquadOption  { id: number; name: string }
interface PersonOption { id: number; name: string }

// ─── Retainer Contracts ───────────────────────────────────────────────────────

interface RetainerRow {
  id: number; clientId: number; squadId: number;
  totalPoolHours: string; status: string;
  validFrom: string; validTo: string | null;
  client: ClientOption; squad: SquadOption;
  _count: { declarations: number; amendments: number };
}

function RetainerContractsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<RetainerRow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", total_pool_hours: "", valid_from: new Date().toISOString().split("T")[0], valid_to: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<RetainerRow | null>(null);
  const [actionType, setActionType] = useState<"pause" | "activate" | "close" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-retainer-contracts"], queryFn: () => api.get<RetainerRow[]>("/management/retainer-contracts").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: squads  = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/retainer-contracts", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), total_pool_hours: Number(f.total_pool_hours), valid_from: f.valid_from, ...(f.valid_to ? { valid_to: f.valid_to } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-retainer-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/retainer-contracts/${id}`, { total_pool_hours: Number(f.total_pool_hours), valid_to: f.valid_to || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-retainer-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => api.post(`/management/retainer-contracts/${id}/status`, { action }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-retainer-contracts"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", squad_id: "", total_pool_hours: "", valid_from: new Date().toISOString().split("T")[0], valid_to: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: RetainerRow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), total_pool_hours: parseFloat(row.totalPoolHours).toFixed(0), valid_from: row.validFrom.split("T")[0], valid_to: row.validTo ? row.validTo.split("T")[0] : "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Contract</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No retainer contracts found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Squad</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Pool Hrs</th>
                <th style={thStyle}>Status</th><th style={thStyle}>From</th><th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isClosed = row.status === "closed";
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.totalPoolHours).toFixed(0)}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.validFrom.split("T")[0]}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.validTo ? row.validTo.split("T")[0] : "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isClosed ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Read-only</span> : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          {row.status === "active" && <button onClick={() => { setActionRow(row); setActionType("pause"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--watch)", background: "var(--watch-bg)", color: "var(--watch)", fontSize: 12, cursor: "pointer" }}>Pause</button>}
                          {row.status === "paused" && <button onClick={() => { setActionRow(row); setActionType("activate"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--safe)", background: "var(--safe-bg)", color: "var(--safe)", fontSize: 12, cursor: "pointer" }}>Activate</button>}
                          <button onClick={() => { setActionRow(row); setActionType("close"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Close</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New Retainer Contract" : "Edit Retainer Contract"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}><label style={labelStyle}>Client *</label>
            <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Squad *</label>
            <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select squad —</option>
              {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Pool Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={form.total_pool_hours} onChange={e => setForm({ ...form, total_pool_hours: e.target.value })} /></div>
            <div><label style={labelStyle}>Valid From *</label><input style={inputStyle} type="date" required value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} disabled={modalMode === "edit"} /></div>
            <div><label style={labelStyle}>Valid To</label><input style={inputStyle} type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {actionRow !== null && actionType !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAction} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            {actionError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{actionError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, textTransform: "capitalize" }}>{actionType} contract?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {actionType === "pause" && "Contract will be paused. It can be reactivated."}
              {actionType === "activate" && "Contract will be reactivated from paused state."}
              {actionType === "close" && "Contract will be permanently closed. This cannot be undone."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={closeAction} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => statusMut.mutate({ id: actionRow.id, action: actionType })} disabled={statusMut.isPending}
                style={{ padding: "8px 18px", borderRadius: 6, border: "none", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: statusMut.isPending ? "not-allowed" : "pointer", opacity: statusMut.isPending ? 0.7 : 1, background: actionType === "close" ? "var(--critical)" : actionType === "pause" ? "var(--watch)" : "var(--safe)" }}>
                {statusMut.isPending ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contract Extensions ──────────────────────────────────────────────────────

interface ExtensionRow {
  id: number; clientId: number; month: string; type: string; status: string;
  requestedHours: string; roleType: string | null; rateOverride: string | null;
  approvedBy: number | null; notes: string | null;
  client: ClientOption;
}

function ContractExtensionsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ExtensionRow | null>(null);
  const [form, setForm] = useState({ client_id: "", month: "", type: "te", requested_hours: "", role_type: "", rate_override: "", notes: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<ExtensionRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "close" | null>(null);
  const [actionForm, setActionForm] = useState({ approved_by: "" });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-contract-extensions"], queryFn: () => api.get<ExtensionRow[]>("/management/contract-extensions").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/contract-extensions", { client_id: Number(f.client_id), month: f.month, type: f.type, requested_hours: Number(f.requested_hours), ...(f.role_type ? { role_type: f.role_type } : {}), ...(f.rate_override ? { rate_override: Number(f.rate_override) } : {}), ...(f.notes ? { notes: f.notes } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contract-extensions"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/contract-extensions/${id}`, { requested_hours: Number(f.requested_hours), role_type: f.role_type || null, rate_override: f.rate_override ? Number(f.rate_override) : null, notes: f.notes || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contract-extensions"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const approveMut = useMutation({
    mutationFn: ({ id, approved_by }: { id: number; approved_by: number }) => api.post(`/management/contract-extensions/${id}/approve`, { approved_by }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contract-extensions"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/contract-extensions/${id}/reject`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contract-extensions"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const closeMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/contract-extensions/${id}/close`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contract-extensions"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", month: "", type: "te", requested_hours: "", role_type: "", rate_override: "", notes: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: ExtensionRow) { setForm({ client_id: row.clientId.toString(), month: row.month.split("T")[0].slice(0,7) + "-01", type: row.type, requested_hours: parseFloat(row.requestedHours).toFixed(0), role_type: row.roleType ?? "", rate_override: row.rateOverride ? parseFloat(row.rateOverride).toFixed(2) : "", notes: row.notes ?? "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); setActionForm({ approved_by: "" }); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  function handleAction() {
    if (!actionRow || !actionType) return;
    if (actionType === "approve") { if (!actionForm.approved_by) { setActionError("approved_by is required."); return; } approveMut.mutate({ id: actionRow.id, approved_by: Number(actionForm.approved_by) }); }
    if (actionType === "reject") rejectMut.mutate(actionRow.id);
    if (actionType === "close") closeMut.mutate(actionRow.id);
  }
  const isPending = createMut.isPending || updateMut.isPending;
  const isActionPending = approveMut.isPending || rejectMut.isPending || closeMut.isPending;
  const TERMINAL_EXT = ["rejected", "closed"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Extension</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No contract extensions found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Month</th><th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Req Hours</th><th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isTerminal = TERMINAL_EXT.includes(row.status);
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0,7)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>{row.type}</td>
                    <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.requestedHours).toFixed(0)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.roleType ? row.roleType.replace(/_/g," ") : "—"}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isTerminal ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Read-only</span> : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {row.status === "pending_approval" && <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>}
                          {row.status === "pending_approval" && <button onClick={() => { setActionRow(row); setActionType("approve"); setActionError(null); setActionForm({ approved_by: "" }); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--safe)", background: "var(--safe-bg)", color: "var(--safe)", fontSize: 12, cursor: "pointer" }}>Approve</button>}
                          {row.status === "pending_approval" && <button onClick={() => { setActionRow(row); setActionType("reject"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Reject</button>}
                          {row.status === "approved" && <button onClick={() => { setActionRow(row); setActionType("close"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Close</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New Contract Extension" : "Edit Contract Extension"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Client *</label>
              <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} disabled={modalMode === "edit"}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} disabled={modalMode === "edit"}>
                <option value="te">TE</option><option value="co">CO</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Month *</label><input style={inputStyle} type="month" required value={form.month.slice(0,7)} onChange={e => setForm({ ...form, month: e.target.value + "-01" })} disabled={modalMode === "edit"} /></div>
            <div><label style={labelStyle}>Req Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={form.requested_hours} onChange={e => setForm({ ...form, requested_hours: e.target.value })} /></div>
            <div><label style={labelStyle}>Rate Override</label><input style={inputStyle} type="number" min="0" step="0.01" value={form.rate_override} onChange={e => setForm({ ...form, rate_override: e.target.value })} /></div>
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Role Type</label>
            <select style={inputStyle} value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })}>
              <option value="">—</option>
              {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
            </select>
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Notes</label><input style={inputStyle} type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {actionRow !== null && actionType !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAction} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            {actionError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{actionError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, textTransform: "capitalize" }}>{actionType} extension?</div>
            {actionType === "approve" && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Approved By (Person) *</label>
                <select style={inputStyle} value={actionForm.approved_by} onChange={e => setActionForm({ approved_by: e.target.value })}>
                  <option value="">— Select person —</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {actionType === "reject" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Extension will be rejected. This cannot be undone.</p>}
            {actionType === "close" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Extension will be closed. This cannot be undone.</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={closeAction} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAction} disabled={isActionPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isActionPending ? "not-allowed" : "pointer", opacity: isActionPending ? 0.7 : 1, background: actionType === "approve" ? "var(--safe)" : "var(--critical)" }}>{isActionPending ? "Processing…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Change Order Line Items Modal ────────────────────────────────────────────

interface LineItemRow { id: number; changeOrderId: number; roleType: string; hours: string; rateOverride: string | null }

function LineItemsModal({ coId, coStatus, onClose }: { coId: number; coStatus: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [liForm, setLiForm] = useState({ role_type: "frontend_dev", hours: "", rate_override: "" });
  const [editingLi, setEditingLi] = useState<LineItemRow | null>(null);
  const [editForm, setEditForm] = useState({ hours: "", rate_override: "" });
  const [liError, setLiError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const PRE_APPROVED = ["pending_written", "pending_docusign"];
  const canEdit = PRE_APPROVED.includes(coStatus);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["mgmt-co-line-items", coId], queryFn: () => api.get<LineItemRow[]>(`/management/change-orders/${coId}/line-items`).then(r => r.data) });

  const createLi = useMutation({
    mutationFn: (f: typeof liForm) => api.post(`/management/change-orders/${coId}/line-items`, { role_type: f.role_type, hours: Number(f.hours), ...(f.rate_override ? { rate_override: Number(f.rate_override) } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-co-line-items", coId] }); setLiForm({ role_type: "frontend_dev", hours: "", rate_override: "" }); setLiError(null); },
    onError: (e: unknown) => setLiError(errMsg(e)),
  });
  const updateLi = useMutation({
    mutationFn: ({ liId, f }: { liId: number; f: typeof editForm }) => api.patch(`/management/change-orders/${coId}/line-items/${liId}`, { hours: Number(f.hours), rate_override: f.rate_override ? Number(f.rate_override) : null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-co-line-items", coId] }); setEditingLi(null); setLiError(null); },
    onError: (e: unknown) => setLiError(errMsg(e)),
  });
  const deleteLi = useMutation({
    mutationFn: (liId: number) => api.delete(`/management/change-orders/${coId}/line-items/${liId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-co-line-items", coId] }); setDeleteId(null); },
    onError: (e: unknown) => setLiError(errMsg(e)),
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 640, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Line Items — CO #{coId}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>×</button>
        </div>
        {liError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{liError}</p>}

        {canEdit && (
          <form onSubmit={e => { e.preventDefault(); createLi.mutate(liForm); }} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, padding: "14px 16px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ flex: 2 }}><label style={{ ...labelStyle, fontSize: 12 }}>Role Type</label>
              <select style={inputStyle} value={liForm.role_type} onChange={e => setLiForm({ ...liForm, role_type: e.target.value })}>
                {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: 12 }}>Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={liForm.hours} onChange={e => setLiForm({ ...liForm, hours: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: 12 }}>Rate Override</label><input style={inputStyle} type="number" min="0" step="0.01" value={liForm.rate_override} onChange={e => setLiForm({ ...liForm, rate_override: e.target.value })} /></div>
            <button type="submit" disabled={createLi.isPending} style={{ padding: "9px 14px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
          </form>
        )}

        {isLoading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          : items.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No line items yet.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate Override</th>
                {canEdit && <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>}
              </tr></thead>
              <tbody>{items.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    {editingLi?.id === item.id ? (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.roleType.replace(/_/g," ")}</span>
                    ) : item.roleType.replace(/_/g," ")}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    {editingLi?.id === item.id
                      ? <input style={{ ...inputStyle, width: 80, textAlign: "right" }} type="number" min="0" step="0.5" value={editForm.hours} onChange={e => setEditForm({ ...editForm, hours: e.target.value })} />
                      : <span style={{ fontSize: 14 }}>{parseFloat(item.hours).toFixed(1)}</span>}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    {editingLi?.id === item.id
                      ? <input style={{ ...inputStyle, width: 80, textAlign: "right" }} type="number" min="0" step="0.01" value={editForm.rate_override} onChange={e => setEditForm({ ...editForm, rate_override: e.target.value })} />
                      : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.rateOverride ? parseFloat(item.rateOverride).toFixed(2) : "—"}</span>}
                  </td>
                  {canEdit && (
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {editingLi?.id === item.id ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => updateLi.mutate({ liId: item.id, f: editForm })} disabled={updateLi.isPending} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 12, cursor: "pointer" }}>Save</button>
                          <button onClick={() => setEditingLi(null)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => { setEditingLi(item); setEditForm({ hours: parseFloat(item.hours).toFixed(1), rate_override: item.rateOverride ? parseFloat(item.rateOverride).toFixed(2) : "" }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => setDeleteId(item.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Del</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}</tbody>
            </table>
          )}

        {deleteId !== null && (
          <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--critical-bg)", borderRadius: 8, border: "1px solid var(--critical)" }}>
            <p style={{ fontSize: 13, color: "var(--critical)", marginBottom: 12 }}>Delete this line item?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => deleteLi.mutate(deleteId)} disabled={deleteLi.isPending} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{deleteLi.isPending ? "Deleting…" : "Delete"}</button>
              <button onClick={() => setDeleteId(null)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Change Orders ────────────────────────────────────────────────────────────

interface ChangeOrderRow {
  id: number; clientId: number; squadId: number; status: string;
  dateRangeStart: string; dateRangeEnd: string;
  writtenApprovalRef: string | null; docusignEnvelopeId: string | null; notes: string | null;
  client: ClientOption; squad: SquadOption;
  _count: { lineItems: number };
}

function ChangeOrdersSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ChangeOrderRow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", date_range_start: "", date_range_end: "", notes: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<ChangeOrderRow | null>(null);
  const [actionType, setActionType] = useState<"written" | "docusign" | "activate" | "close" | null>(null);
  const [actionForm, setActionForm] = useState({ written_approval_ref: "", docusign_envelope_id: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [liCoId, setLiCoId] = useState<number | null>(null);
  const [liCoStatus, setLiCoStatus] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-change-orders"], queryFn: () => api.get<ChangeOrderRow[]>("/management/change-orders").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: squads  = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/change-orders", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), date_range_start: f.date_range_start, date_range_end: f.date_range_end, ...(f.notes ? { notes: f.notes } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => api.patch(`/management/change-orders/${id}`, { notes: notes || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const writtenMut = useMutation({
    mutationFn: ({ id, ref }: { id: number; ref: string }) => api.post(`/management/change-orders/${id}/written-approval`, { written_approval_ref: ref }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const docusignMut = useMutation({
    mutationFn: ({ id, envId }: { id: number; envId: string }) => api.post(`/management/change-orders/${id}/docusign`, { docusign_envelope_id: envId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const activateMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/change-orders/${id}/activate`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const closeMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/change-orders/${id}/close`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-change-orders"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", squad_id: "", date_range_start: "", date_range_end: "", notes: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: ChangeOrderRow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), date_range_start: row.dateRangeStart.split("T")[0], date_range_end: row.dateRangeEnd.split("T")[0], notes: row.notes ?? "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); setActionForm({ written_approval_ref: "", docusign_envelope_id: "" }); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, notes: form.notes }); }
  function handleAction() {
    if (!actionRow || !actionType) return;
    if (actionType === "written") { if (!actionForm.written_approval_ref) { setActionError("Written approval ref required."); return; } writtenMut.mutate({ id: actionRow.id, ref: actionForm.written_approval_ref }); }
    if (actionType === "docusign") { if (!actionForm.docusign_envelope_id) { setActionError("DocuSign envelope ID required."); return; } docusignMut.mutate({ id: actionRow.id, envId: actionForm.docusign_envelope_id }); }
    if (actionType === "activate") activateMut.mutate(actionRow.id);
    if (actionType === "close") closeMut.mutate(actionRow.id);
  }
  const isPending = createMut.isPending || updateMut.isPending;
  const isActionPending = writtenMut.isPending || docusignMut.isPending || activateMut.isPending || closeMut.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Change Order</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No change orders found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Squad</th>
                <th style={thStyle}>Date Range</th><th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Line Items</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isClosed = row.status === "closed";
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{row.dateRangeStart.split("T")[0]} – {row.dateRangeEnd.split("T")[0]}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      <button onClick={() => { setLiCoId(row.id); setLiCoStatus(row.status); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>{row._count.lineItems} item{row._count.lineItems !== 1 ? "s" : ""}</button>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isClosed ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Read-only</span> : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          {row.status === "pending_written" && <button onClick={() => { setActionRow(row); setActionType("written"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--watch)", background: "var(--watch-bg)", color: "var(--watch)", fontSize: 12, cursor: "pointer" }}>Submit Written</button>}
                          {row.status === "pending_docusign" && <button onClick={() => { setActionRow(row); setActionType("docusign"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--warning)", background: "var(--warning-bg)", color: "var(--warning)", fontSize: 12, cursor: "pointer" }}>Submit DocuSign</button>}
                          {row.status === "approved" && <button onClick={() => { setActionRow(row); setActionType("activate"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--safe)", background: "var(--safe-bg)", color: "var(--safe)", fontSize: 12, cursor: "pointer" }}>Activate</button>}
                          {row.status === "active" && <button onClick={() => { setActionRow(row); setActionType("close"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Close</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      {liCoId !== null && liCoStatus !== null && <LineItemsModal coId={liCoId} coStatus={liCoStatus} onClose={() => { setLiCoId(null); setLiCoStatus(null); }} />}

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New Change Order" : "Edit Change Order"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          {modalMode === "create" && (
            <>
              <div style={fieldStyle}><label style={labelStyle}>Client *</label>
                <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={fieldStyle}><label style={labelStyle}>Squad *</label>
                <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })}>
                  <option value="">— Select squad —</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Start Date *</label><input style={inputStyle} type="date" required value={form.date_range_start} onChange={e => setForm({ ...form, date_range_start: e.target.value })} /></div>
                <div><label style={labelStyle}>End Date *</label><input style={inputStyle} type="date" required value={form.date_range_end} onChange={e => setForm({ ...form, date_range_end: e.target.value })} /></div>
              </div>
            </>
          )}
          <div style={fieldStyle}><label style={labelStyle}>Notes</label><input style={inputStyle} type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {actionRow !== null && actionType !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAction} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 420, maxWidth: "90vw" }}>
            {actionError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{actionError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              {actionType === "written" && "Submit Written Approval"}
              {actionType === "docusign" && "Submit DocuSign"}
              {actionType === "activate" && "Activate Change Order?"}
              {actionType === "close" && "Close Change Order?"}
            </div>
            {actionType === "written" && (
              <div style={fieldStyle}><label style={labelStyle}>Written Approval Ref *</label><input style={inputStyle} type="text" value={actionForm.written_approval_ref} onChange={e => setActionForm({ ...actionForm, written_approval_ref: e.target.value })} placeholder="e.g. email ref, ticket ID…" /></div>
            )}
            {actionType === "docusign" && (
              <div style={fieldStyle}><label style={labelStyle}>DocuSign Envelope ID *</label><input style={inputStyle} type="text" value={actionForm.docusign_envelope_id} onChange={e => setActionForm({ ...actionForm, docusign_envelope_id: e.target.value })} /></div>
            )}
            {actionType === "activate" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Moves change order from approved to active.</p>}
            {actionType === "close" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Permanently closes this change order. Cannot be undone.</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={closeAction} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAction} disabled={isActionPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isActionPending ? "not-allowed" : "pointer", opacity: isActionPending ? 0.7 : 1, background: actionType === "close" ? "var(--critical)" : actionType === "activate" ? "var(--safe)" : "var(--primary)" }}>{isActionPending ? "Processing…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SME Engagements ──────────────────────────────────────────────────────────

interface SMERow {
  id: number; clientId: number; squadId: number; month: string;
  roleDescription: string; source: string; personId: number | null;
  contractedHours: string; costRate: string; billingRate: string;
  currency: string; approvedBy: number | null; status: string;
  client: ClientOption; squad: SquadOption;
  person: PersonOption | null;
}

function SMEEngagementsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SMERow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", month: "", role_description: "", source: "internal_other_squad", person_id: "", contracted_hours: "", cost_rate: "", billing_rate: "", currency: "USD" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<SMERow | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "activate" | "close" | null>(null);
  const [actionForm, setActionForm] = useState({ approved_by: "" });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-sme-engagements"], queryFn: () => api.get<SMERow[]>("/management/sme-engagements").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: squads  = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/sme-engagements", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), month: f.month + "-01", role_description: f.role_description, source: f.source, ...(f.person_id ? { person_id: Number(f.person_id) } : {}), contracted_hours: Number(f.contracted_hours), cost_rate: Number(f.cost_rate), billing_rate: Number(f.billing_rate), currency: f.currency }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sme-engagements"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/sme-engagements/${id}`, { ...(f.person_id ? { person_id: Number(f.person_id) } : { person_id: null }), contracted_hours: Number(f.contracted_hours), cost_rate: Number(f.cost_rate), billing_rate: Number(f.billing_rate) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sme-engagements"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const confirmMut = useMutation({
    mutationFn: ({ id, approved_by }: { id: number; approved_by: number }) => api.post(`/management/sme-engagements/${id}/confirm`, { approved_by }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sme-engagements"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const activateMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/sme-engagements/${id}/activate`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sme-engagements"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const closeMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/sme-engagements/${id}/close`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sme-engagements"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", squad_id: "", month: "", role_description: "", source: "internal_other_squad", person_id: "", contracted_hours: "", cost_rate: "", billing_rate: "", currency: "USD" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: SMERow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), month: row.month.split("T")[0].slice(0,7), role_description: row.roleDescription, source: row.source, person_id: row.personId?.toString() ?? "", contracted_hours: parseFloat(row.contractedHours).toFixed(0), cost_rate: parseFloat(row.costRate).toFixed(2), billing_rate: parseFloat(row.billingRate).toFixed(2), currency: row.currency }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); setActionForm({ approved_by: "" }); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  function handleAction() {
    if (!actionRow || !actionType) return;
    if (actionType === "confirm") { if (!actionForm.approved_by) { setActionError("approved_by is required."); return; } confirmMut.mutate({ id: actionRow.id, approved_by: Number(actionForm.approved_by) }); }
    if (actionType === "activate") activateMut.mutate(actionRow.id);
    if (actionType === "close") closeMut.mutate(actionRow.id);
  }
  const isPending = createMut.isPending || updateMut.isPending;
  const isActionPending = confirmMut.isPending || activateMut.isPending || closeMut.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add SME Engagement</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No SME engagements found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Squad</th><th style={thStyle}>Month</th>
                <th style={thStyle}>Role</th><th style={thStyle}>Person</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hours</th>
                <th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isClosed = row.status === "closed";
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0,7)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.roleDescription}>{row.roleDescription}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.person?.name ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.contractedHours).toFixed(0)}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isClosed ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Read-only</span> : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          {row.status === "requested" && <button onClick={() => { setActionRow(row); setActionType("confirm"); setActionError(null); setActionForm({ approved_by: "" }); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--watch)", background: "var(--watch-bg)", color: "var(--watch)", fontSize: 12, cursor: "pointer" }}>Confirm</button>}
                          {row.status === "confirmed" && <button onClick={() => { setActionRow(row); setActionType("activate"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--safe)", background: "var(--safe-bg)", color: "var(--safe)", fontSize: 12, cursor: "pointer" }}>Activate</button>}
                          {row.status === "active" && <button onClick={() => { setActionRow(row); setActionType("close"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Close</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New SME Engagement" : "Edit SME Engagement"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          {modalMode === "create" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Client *</label>
                  <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                    <option value="">— Select client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Squad *</label>
                  <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })}>
                    <option value="">— Select squad —</option>
                    {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Month *</label><input style={inputStyle} type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                <div><label style={labelStyle}>Source</label>
                  <select style={inputStyle} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                    <option value="internal_other_squad">Internal (Other Squad)</option>
                    <option value="external_contractor">External Contractor</option>
                  </select>
                </div>
              </div>
            </>
          )}
          <div style={fieldStyle}><label style={labelStyle}>Role Description *</label><input style={inputStyle} type="text" required value={form.role_description} onChange={e => setForm({ ...form, role_description: e.target.value })} disabled={modalMode === "edit"} /></div>
          <div style={fieldStyle}><label style={labelStyle}>Person</label>
            <select style={inputStyle} value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })}>
              <option value="">—</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={form.contracted_hours} onChange={e => setForm({ ...form, contracted_hours: e.target.value })} /></div>
            <div><label style={labelStyle}>Cost Rate *</label><input style={inputStyle} type="number" min="0" step="0.01" required value={form.cost_rate} onChange={e => setForm({ ...form, cost_rate: e.target.value })} /></div>
            <div><label style={labelStyle}>Billing Rate *</label><input style={inputStyle} type="number" min="0" step="0.01" required value={form.billing_rate} onChange={e => setForm({ ...form, billing_rate: e.target.value })} /></div>
            <div><label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} disabled={modalMode === "edit"}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {actionRow !== null && actionType !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAction} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            {actionError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{actionError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, textTransform: "capitalize" }}>{actionType} engagement?</div>
            {actionType === "confirm" && (
              <div style={fieldStyle}><label style={labelStyle}>Approved By (Person) *</label>
                <select style={inputStyle} value={actionForm.approved_by} onChange={e => setActionForm({ approved_by: e.target.value })}>
                  <option value="">— Select person —</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {actionType === "activate" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Moves engagement from confirmed to active.</p>}
            {actionType === "close" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Permanently closes this engagement.</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={closeAction} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAction} disabled={isActionPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isActionPending ? "not-allowed" : "pointer", opacity: isActionPending ? 0.7 : 1, background: actionType === "close" ? "var(--critical)" : actionType === "confirm" ? "var(--watch)" : "var(--safe)" }}>{isActionPending ? "Processing…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Monthly Role Declarations ────────────────────────────────────────────────

interface DeclarationRow {
  id: number; contractId: number | null; extensionId: number | null;
  clientId: number; squadId: number; month: string;
  roleType: string; declaredHours: string; status: string;
  submittedBy: number | null;
  client: ClientOption; squad: SquadOption;
}

function DeclarationsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<DeclarationRow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", month: "", role_type: "frontend_dev", declared_hours: "", contract_id: "", extension_id: "", override_reason: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<DeclarationRow | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "lock" | null>(null);
  const [actionForm, setActionForm] = useState({ submitted_by: "" });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-declarations"], queryFn: () => api.get<DeclarationRow[]>("/management/declarations").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: squads  = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/declarations", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), month: f.month + "-01", role_type: f.role_type, declared_hours: Number(f.declared_hours), ...(f.contract_id ? { contract_id: Number(f.contract_id) } : {}), ...(f.extension_id ? { extension_id: Number(f.extension_id) } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/declarations/${id}`, { declared_hours: Number(f.declared_hours), ...(f.override_reason ? { override_reason: f.override_reason } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const confirmMut = useMutation({
    mutationFn: ({ id, submitted_by }: { id: number; submitted_by: number }) => api.post(`/management/declarations/${id}/confirm`, { submitted_by }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const lockMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/declarations/${id}/lock`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", squad_id: "", month: "", role_type: "frontend_dev", declared_hours: "", contract_id: "", extension_id: "", override_reason: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: DeclarationRow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), month: row.month.split("T")[0].slice(0,7), role_type: row.roleType, declared_hours: parseFloat(row.declaredHours).toFixed(0), contract_id: row.contractId?.toString() ?? "", extension_id: row.extensionId?.toString() ?? "", override_reason: "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); setActionForm({ submitted_by: "" }); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  function handleAction() {
    if (!actionRow || !actionType) return;
    if (actionType === "confirm") { if (!actionForm.submitted_by) { setActionError("submitted_by is required."); return; } confirmMut.mutate({ id: actionRow.id, submitted_by: Number(actionForm.submitted_by) }); }
    if (actionType === "lock") lockMut.mutate(actionRow.id);
  }
  const isPending = createMut.isPending || updateMut.isPending;
  const isActionPending = confirmMut.isPending || lockMut.isPending;
  const TERMINAL_DECL = ["locked", "derived"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Declaration</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No declarations found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Squad</th>
                <th style={thStyle}>Month</th><th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hours</th>
                <th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => {
                const isTerminal = TERMINAL_DECL.includes(row.status);
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.squad.name}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.month.split("T")[0].slice(0,7)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12 }}>{row.roleType.replace(/_/g," ")}</td>
                    <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{parseFloat(row.declaredHours).toFixed(0)}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      {isTerminal ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Read-only</span> : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          {row.status === "draft" && <button onClick={() => { setActionRow(row); setActionType("confirm"); setActionError(null); setActionForm({ submitted_by: "" }); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--watch)", background: "var(--watch-bg)", color: "var(--watch)", fontSize: 12, cursor: "pointer" }}>Confirm</button>}
                          {row.status === "confirmed" && <button onClick={() => { setActionRow(row); setActionType("lock"); setActionError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--text-muted)", background: "var(--border)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Lock</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New Declaration" : "Edit Declaration"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          {modalMode === "create" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Client *</label>
                  <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                    <option value="">— Select client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Squad *</label>
                  <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })}>
                    <option value="">— Select squad —</option>
                    {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Month *</label><input style={inputStyle} type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
                <div><label style={labelStyle}>Role Type *</label>
                  <select style={inputStyle} required value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })}>
                    {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div><label style={labelStyle}>Contract ID</label><input style={inputStyle} type="number" min="1" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} placeholder="optional" /></div>
                <div><label style={labelStyle}>Extension ID</label><input style={inputStyle} type="number" min="1" value={form.extension_id} onChange={e => setForm({ ...form, extension_id: e.target.value })} placeholder="optional" /></div>
              </div>
            </>
          )}
          <div style={fieldStyle}><label style={labelStyle}>Declared Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={form.declared_hours} onChange={e => setForm({ ...form, declared_hours: e.target.value })} /></div>
          {modalMode === "edit" && <div style={fieldStyle}><label style={labelStyle}>Override Reason</label><input style={inputStyle} type="text" value={form.override_reason} onChange={e => setForm({ ...form, override_reason: e.target.value })} /></div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {actionRow !== null && actionType !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAction} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            {actionError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{actionError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, textTransform: "capitalize" }}>{actionType} declaration?</div>
            {actionType === "confirm" && (
              <div style={fieldStyle}><label style={labelStyle}>Submitted By (Person) *</label>
                <select style={inputStyle} value={actionForm.submitted_by} onChange={e => setActionForm({ submitted_by: e.target.value })}>
                  <option value="">— Select person —</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {actionType === "lock" && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Declaration will be locked. No further edits possible.</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={closeAction} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAction} disabled={isActionPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isActionPending ? "not-allowed" : "pointer", opacity: isActionPending ? 0.7 : 1, background: actionType === "lock" ? "var(--text-muted)" : "var(--watch)" }}>{isActionPending ? "Processing…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ContractsTab() {
  const [sub, setSub] = useState<SubTab>("retainer");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "retainer",       label: "Retainer Contracts" },
    { id: "extensions",     label: "Contract Extensions" },
    { id: "change-orders",  label: "Change Orders" },
    { id: "sme",            label: "SME Engagements" },
    { id: "declarations",   label: "Role Declarations" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {SUB_TABS.map(t => <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>)}
      </div>
      {sub === "retainer"       && <RetainerContractsSection />}
      {sub === "extensions"     && <ContractExtensionsSection />}
      {sub === "change-orders"  && <ChangeOrdersSection />}
      {sub === "sme"            && <SMEEngagementsSection />}
      {sub === "declarations"   && <DeclarationsSection />}
    </div>
  );
}
