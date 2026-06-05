"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";

type SubTab = "declarations";

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

const ROLE_TYPES = ["dev","devops","qa","design","product","project","tl","sre","data","seo","content"];

interface ClientOption { id: number; name: string }
interface SquadOption  { id: number; name: string }
interface PersonOption { id: number; name: string }

// ─── Monthly Role Declarations ────────────────────────────────────────────────

interface DeclarationRow {
  id: number; contractId: number | null;
  clientId: number; squadId: number; month: string;
  roleType: string; declaredHours: string; status: string;
  submittedBy: number | null;
  client: ClientOption; squad: SquadOption;
}

function DeclarationsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<DeclarationRow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", month: "", role_type: "dev", declared_hours: "", contract_id: "", override_reason: "" });
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
    mutationFn: (f: typeof form) => api.post("/management/declarations", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), month: f.month + "-01", role_type: f.role_type, declared_hours: Number(f.declared_hours), ...(f.contract_id ? { contract_id: Number(f.contract_id) } : {}) }).then(r => r.data),
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

  function openCreate() { setForm({ client_id: "", squad_id: "", month: "", role_type: "dev", declared_hours: "", contract_id: "", override_reason: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: DeclarationRow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), month: row.month.split("T")[0].slice(0,7), role_type: row.roleType, declared_hours: parseFloat(row.declaredHours).toFixed(0), contract_id: row.contractId?.toString() ?? "", override_reason: "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
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
              <div style={{ marginBottom: 18 }}>
                <div><label style={labelStyle}>Contract ID</label><input style={inputStyle} type="number" min="1" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} placeholder="optional" /></div>
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
  return <DeclarationsSection />;
}
