"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";

type SubTab = "clients" | "sows" | "contracts";

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
    fontWeight: active ? 600 : 400,
    color: active ? "var(--primary)" : "var(--text-muted)",
    cursor: "pointer",
    borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
    marginBottom: -1, borderRadius: 0,
  };
}

function fmtDate(iso: string) { return iso.split("T")[0]; }

// ── Clients Section ───────────────────────────────────────────────────────────

interface ClientRecord {
  id: number; name: string; region: string; currency: string; isActive: boolean; createdAt: string;
}
interface ClientFormState { name: string; region: string; currency: string; }
const defaultClientForm: ClientFormState = { name: "", region: "na", currency: "USD" };

function ClientsSection() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [archiving, setArchiving] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<ClientFormState>(defaultClientForm);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["mgmt-clients", showArchived],
    queryFn: () => api.get<ClientRecord[]>(`/management/clients?includeArchived=${showArchived}`).then(r => r.data),
  });
  const createMutation = useMutation({
    mutationFn: (f: ClientFormState) => api.post("/management/clients", f).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: ClientFormState }) => api.patch(`/management/clients/${id}`, f).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); closeModal(); },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/clients/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); setArchiving(null); },
  });
  const unarchiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/clients/${id}/unarchive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); },
  });

  function openCreate() { setForm(defaultClientForm); setEditing(null); setModalMode("create"); }
  function openEdit(c: ClientRecord) { setForm({ name: c.name, region: c.region, currency: c.currency }); setEditing(c); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setShowArchived(!showArchived)} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--border)", background: showArchived ? "var(--primary-light)" : "var(--bg)", color: showArchived ? "var(--primary)" : "var(--text-muted)", fontSize: 13, fontWeight: showArchived ? 600 : 400, cursor: "pointer" }}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </button>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Client</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : clients.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No clients found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Name</th><th style={thStyle}>Region</th><th style={thStyle}>Currency</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{clients.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: c.region === "na" ? "rgba(59,130,246,0.08)" : "rgba(99,102,241,0.08)", color: c.region === "na" ? "#2563eb" : "#6366f1", fontWeight: 600, textTransform: "uppercase" }}>{c.region}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{c.currency}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: c.isActive ? "var(--safe-bg)" : "var(--border)", color: c.isActive ? "var(--safe)" : "var(--text-muted)" }}>{c.isActive ? "Active" : "Archived"}</span>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(c)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer", color: "var(--text)" }}>Edit</button>
                      {c.isActive ? (
                        <button onClick={() => setArchiving(c)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Archive</button>
                      ) : (
                        <button onClick={() => unarchiveMutation.mutate(c.id)} disabled={unarchiveMutation.isPending} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--safe)", background: "transparent", color: "var(--safe)", fontSize: 12, cursor: unarchiveMutation.isPending ? "not-allowed" : "pointer", opacity: unarchiveMutation.isPending ? 0.6 : 1 }}>Unarchive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Client" : `Edit Client — ${editing?.name}`}>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}><label style={labelStyle}>Name *</label>
            <input style={inputStyle} type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Client name" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Region *</label>
              <select style={inputStyle} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
                <option value="na">NA</option><option value="emea">EMEA</option>
              </select>
            </div>
            <div><label style={labelStyle}>Currency *</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
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
      <ArchiveConfirmDialog isOpen={archiving !== null} entityName={archiving?.name ?? ""} onConfirm={() => archiving && archiveMutation.mutate(archiving.id)} onCancel={() => setArchiving(null)} isPending={archiveMutation.isPending} />
    </div>
  );
}

// ── SOWs Section ──────────────────────────────────────────────────────────────

interface SowRecord {
  id: number; name: string; clientId: number; startDate: string; endDate: string | null;
  client: { id: number; name: string };
}
interface ClientOption { id: number; name: string; }
interface SowFormState { name: string; client_id: string; start_date: string; end_date: string; }

function SowsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SowRecord | null>(null);
  const [form, setForm] = useState<SowFormState>({ name: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: sows = [], isLoading } = useQuery({
    queryKey: ["mgmt-sows"],
    queryFn: () => api.get<SowRecord[]>("/management/statement-of-works").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["mgmt-clients-active"],
    queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: SowFormState) => api.post("/management/statement-of-works", { name: f.name, client_id: Number(f.client_id), start_date: f.start_date, end_date: f.end_date || undefined }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: SowFormState }) => api.patch(`/management/statement-of-works/${id}`, { name: f.name, start_date: f.start_date, end_date: f.end_date || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/statement-of-works/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); setDeleteId(null); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });

  function openCreate() { setForm({ name: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(s: SowRecord) { setForm({ name: s.name, client_id: s.clientId.toString(), start_date: fmtDate(s.startDate), end_date: s.endDate ? fmtDate(s.endDate) : "" }); setEditing(s); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add SOW</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : sows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No statements of work found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Name</th><th style={thStyle}>Client</th>
                <th style={thStyle}>Start</th><th style={thStyle}>End</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{sows.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{s.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(s.startDate)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{s.endDate ? fmtDate(s.endDate) : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(s)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => { setApiError(null); setDeleteId(s.id); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Statement of Work" : `Edit SOW — ${editing?.name}`}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}><label style={labelStyle}>Name *</label>
            <input style={inputStyle} type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="SOW name" />
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Client *</label>
            <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {modalMode === "edit" && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Client is immutable after creation.</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Start Date *</label><input style={inputStyle} type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label style={labelStyle}>End Date</label><input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>
      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete SOW?</div>
            {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Cannot delete if contracts exist under this SOW.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contracts Section ─────────────────────────────────────────────────────────

interface ContractRecord {
  id: number; name: string; sowId: number;
  hourType: "monthly" | "total"; type: "base" | "change_order";
  assignedHours: string; startDate: string; endDate: string | null;
  status: "active" | "paused" | "closed";
  sow: { id: number; name: string; client: { id: number; name: string } };
}
interface SowOption { id: number; name: string; client: { id: number; name: string }; }
interface ContractFormState {
  name: string; sow_id: string; hour_type: "monthly" | "total";
  type: "base" | "change_order"; assigned_hours: string;
  start_date: string; end_date: string; status: "active" | "paused" | "closed";
  client_filter: string;
}

function ContractsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ContractRecord | null>(null);
  const [form, setForm] = useState<ContractFormState>({ name: "", sow_id: "", hour_type: "monthly", type: "base", assigned_hours: "", start_date: new Date().toISOString().split("T")[0], end_date: "", status: "active", client_filter: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["mgmt-contracts"],
    queryFn: () => api.get<ContractRecord[]>("/management/contracts").then(r => r.data),
  });
  const { data: sows = [] } = useQuery({
    queryKey: ["mgmt-sows-with-clients"],
    queryFn: () => api.get<SowOption[]>("/management/statement-of-works").then(r => r.data),
  });

  const filteredSows = form.client_filter
    ? sows.filter(s => s.client.id.toString() === form.client_filter)
    : sows;

  const uniqueClients = Array.from(new Map(sows.map(s => [s.client.id, s.client])).values());

  const createMutation = useMutation({
    mutationFn: (f: ContractFormState) => api.post("/management/contracts", { name: f.name, sow_id: Number(f.sow_id), hour_type: f.hour_type, type: f.type, assigned_hours: parseFloat(f.assigned_hours), start_date: f.start_date, end_date: f.end_date || undefined, status: f.status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: ContractFormState }) => api.patch(`/management/contracts/${id}`, { name: f.name, hour_type: f.hour_type, type: f.type, assigned_hours: parseFloat(f.assigned_hours), start_date: f.start_date, end_date: f.end_date || null, status: f.status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/contracts/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); setDeleteId(null); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });

  function openCreate() { setForm({ name: "", sow_id: "", hour_type: "monthly", type: "base", assigned_hours: "", start_date: new Date().toISOString().split("T")[0], end_date: "", status: "active", client_filter: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(c: ContractRecord) {
    setForm({ name: c.name, sow_id: c.sowId.toString(), hour_type: c.hourType, type: c.type, assigned_hours: c.assignedHours, start_date: fmtDate(c.startDate), end_date: c.endDate ? fmtDate(c.endDate) : "", status: c.status, client_filter: c.sow.client.id.toString() });
    setEditing(c); setApiError(null); setModalMode("edit");
  }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  function statusBadge(s: string) {
    const colors: Record<string, { bg: string; color: string }> = { active: { bg: "var(--safe-bg)", color: "var(--safe)" }, paused: { bg: "rgba(245,158,11,0.1)", color: "#d97706" }, closed: { bg: "var(--border)", color: "var(--text-muted)" } };
    const c = colors[s] ?? colors.closed;
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: c.bg, color: c.color }}>{s}</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Contract</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : contracts.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No contracts found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Name</th><th style={thStyle}>SOW</th><th style={thStyle}>Client</th>
                <th style={thStyle}>Type</th><th style={thStyle}>Hours</th>
                <th style={thStyle}>Start</th><th style={thStyle}>End</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{contracts.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{c.sow.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{c.sow.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>
                    <span style={{ fontFamily: "monospace" }}>{c.type.replace("_", " ")} / {c.hourType}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{parseFloat(c.assignedHours).toFixed(0)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(c.startDate)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{c.endDate ? fmtDate(c.endDate) : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>{statusBadge(c.status)}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(c)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => { setApiError(null); setDeleteId(c.id); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Contract" : `Edit Contract — ${editing?.name}`}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}><label style={labelStyle}>Name *</label>
            <input style={inputStyle} type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contract name" />
          </div>
          {modalMode === "create" && (
            <div style={fieldStyle}><label style={labelStyle}>Filter by Client</label>
              <select style={inputStyle} value={form.client_filter} onChange={e => setForm({ ...form, client_filter: e.target.value, sow_id: "" })}>
                <option value="">— All clients —</option>
                {uniqueClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div style={fieldStyle}><label style={labelStyle}>Statement of Work *</label>
            <select style={inputStyle} required value={form.sow_id} onChange={e => setForm({ ...form, sow_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select SOW —</option>
              {filteredSows.map(s => <option key={s.id} value={s.id}>{s.name} ({s.client.name})</option>)}
            </select>
            {modalMode === "edit" && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>SOW is immutable after creation.</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Hour Type *</label>
              <select style={inputStyle} value={form.hour_type} onChange={e => setForm({ ...form, hour_type: e.target.value as "monthly" | "total" })}>
                <option value="monthly">Monthly</option><option value="total">Total</option>
              </select>
            </div>
            <div><label style={labelStyle}>Contract Type *</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as "base" | "change_order" })}>
                <option value="base">Base</option>
                <option value="change_order">Change Order</option>
                <option value="extension">Extension</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Assigned Hours *</label><input style={inputStyle} type="number" min="0" step="0.5" required value={form.assigned_hours} onChange={e => setForm({ ...form, assigned_hours: e.target.value })} /></div>
            <div><label style={labelStyle}>Start Date *</label><input style={inputStyle} type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label style={labelStyle}>End Date</label><input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as "active" | "paused" | "closed" })}>
              <option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>
      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete Contract?</div>
            {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Cannot delete if declarations exist.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function ClientsTab() {
  const [sub, setSub] = useState<SubTab>("clients");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "clients", label: "Clients" },
    { id: "sows", label: "Statements of Work" },
    { id: "contracts", label: "Contracts" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>
        ))}
      </div>
      {sub === "clients" && <ClientsSection />}
      {sub === "sows" && <SowsSection />}
      {sub === "contracts" && <ContractsSection />}
    </div>
  );
}
