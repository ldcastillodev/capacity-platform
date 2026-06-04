"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { SquadsTab } from "./SquadsTab";
import { PersonsTab } from "./PersonsTab";

type SubTab = "squads" | "persons" | "memberships" | "roles" | "capacity";

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

// ── Memberships ──────────────────────────────────────────────────────────────

interface MembershipRow {
  id: number; personId: number; squadId: number;
  allocationPct: string; effectiveFrom: string; effectiveTo: string | null;
  person: { id: number; name: string };
  squad: { id: number; name: string };
}
interface SquadOption { id: number; name: string }
interface PersonOption { id: number; name: string }

function MembershipsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [form, setForm] = useState({ person_id: "", squad_id: "", allocation_pct: "100", effective_from: new Date().toISOString().split("T")[0], effective_to: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-memberships"],
    queryFn: () => api.get<MembershipRow[]>("/management/squad-memberships").then(r => r.data),
  });
  const { data: squads = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/squad-memberships", {
      person_id: Number(f.person_id), squad_id: Number(f.squad_id),
      allocation_pct: parseFloat(f.allocation_pct) / 100,
      effective_from: f.effective_from,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-memberships"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/squad-memberships/${id}`, {
      allocation_pct: parseFloat(f.allocation_pct) / 100,
      effective_to: f.effective_to || null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-memberships"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/squad-memberships/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-memberships"] }); setDeleteId(null); },
  });

  function openCreate() { setForm({ person_id: "", squad_id: "", allocation_pct: "100", effective_from: new Date().toISOString().split("T")[0], effective_to: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: MembershipRow) {
    setForm({ person_id: row.personId.toString(), squad_id: row.squadId.toString(), allocation_pct: (parseFloat(row.allocationPct) * 100).toFixed(0), effective_from: row.effectiveFrom.split("T")[0], effective_to: row.effectiveTo ? row.effectiveTo.split("T")[0] : "" });
    setEditing(row); setApiError(null); setModalMode("edit");
  }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setApiError(null);
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Membership</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No memberships found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th><th style={thStyle}>Squad</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Allocation %</th>
                <th style={thStyle}>From</th><th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.person.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, color: "var(--text-muted)" }}>{row.squad.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{(parseFloat(row.allocationPct) * 100).toFixed(0)}%</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(row)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setDeleteId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Membership" : "Edit Membership"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Person *</label>
            <select style={inputStyle} required value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select person —</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Squad *</label>
            <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select squad —</option>
              {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Allocation %</label><input style={inputStyle} type="number" min="1" max="100" step="1" value={form.allocation_pct} onChange={e => setForm({ ...form, allocation_pct: e.target.value })} /></div>
            <div><label style={labelStyle}>From *</label><input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} disabled={modalMode === "edit"} /></div>
            <div><label style={labelStyle}>To</label><input style={inputStyle} type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
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
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete membership?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This action is permanent and cannot be undone.</p>
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

// ── Person Roles ─────────────────────────────────────────────────────────────

const ROLE_TYPES = ["frontend_dev","backend_dev","fullstack_dev","devops","qa","ux_designer","product_manager","project_manager","tech_lead","solutions_architect","data_engineer","scrum_master","business_analyst","seo","content_author","client_services"];
const SENIORITIES = ["L1","L2","L3","L4","L5"];

interface RoleRow {
  id: number; personId: number; roleType: string; seniority: string | null;
  isPrimary: boolean; effectiveFrom: string; effectiveTo: string | null;
  person: { id: number; name: string };
}

function PersonRolesSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({ person_id: "", role_type: "frontend_dev", seniority: "", is_primary: true, effective_from: new Date().toISOString().split("T")[0], effective_to: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-person-roles"],
    queryFn: () => api.get<RoleRow[]>("/management/person-roles").then(r => r.data),
  });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/person-roles", { person_id: Number(f.person_id), role_type: f.role_type, seniority: f.seniority || undefined, is_primary: f.is_primary, effective_from: f.effective_from }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/person-roles/${id}`, { seniority: f.seniority || null, is_primary: f.is_primary, effective_to: f.effective_to || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/person-roles/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] }); setDeleteId(null); },
  });

  function openCreate() { setForm({ person_id: "", role_type: "frontend_dev", seniority: "", is_primary: true, effective_from: new Date().toISOString().split("T")[0], effective_to: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: RoleRow) { setForm({ person_id: row.personId.toString(), role_type: row.roleType, seniority: row.seniority ?? "", is_primary: row.isPrimary, effective_from: row.effectiveFrom.split("T")[0], effective_to: row.effectiveTo ? row.effectiveTo.split("T")[0] : "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Role</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No roles found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th><th style={thStyle}>Role</th><th style={thStyle}>Seniority</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Primary</th>
                <th style={thStyle}>From</th><th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.person.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.roleType.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.seniority ?? "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: row.isPrimary ? "var(--safe-bg)" : "var(--border)", color: row.isPrimary ? "var(--safe)" : "var(--text-muted)" }}>{row.isPrimary ? "Yes" : "No"}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(row)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setDeleteId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Person Role" : "Edit Person Role"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}><label style={labelStyle}>Person *</label>
            <select style={inputStyle} required value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select person —</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Role Type *</label>
              <select style={inputStyle} value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })} disabled={modalMode === "edit"}>
                {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Seniority</label>
              <select style={inputStyle} value={form.seniority} onChange={e => setForm({ ...form, seniority: e.target.value })}>
                <option value="">—</option>
                {SENIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Primary</label>
              <select style={inputStyle} value={form.is_primary ? "true" : "false"} onChange={e => setForm({ ...form, is_primary: e.target.value === "true" })}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            </div>
            <div><label style={labelStyle}>From *</label><input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} disabled={modalMode === "edit"} /></div>
            <div><label style={labelStyle}>To</label><input style={inputStyle} type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
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
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete role?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This is permanent.</p>
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

// ── Capacity Configs ──────────────────────────────────────────────────────────

interface CapacityRow {
  id: number; squadId: number; roleType: string;
  hardBufferPct: string; softBufferPct: string;
  squad: { id: number; name: string };
}

function CapacityConfigSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<CapacityRow | null>(null);
  const [form, setForm] = useState({ squad_id: "", role_type: "frontend_dev", hard_buffer_pct: "15", soft_buffer_pct: "10" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-capacity-configs"], queryFn: () => api.get<CapacityRow[]>("/management/squad-capacity-configs").then(r => r.data) });
  const { data: squads = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/squad-capacity-configs", { squad_id: Number(f.squad_id), role_type: f.role_type, hard_buffer_pct: parseFloat(f.hard_buffer_pct) / 100, soft_buffer_pct: parseFloat(f.soft_buffer_pct) / 100 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-capacity-configs"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/squad-capacity-configs/${id}`, { hard_buffer_pct: parseFloat(f.hard_buffer_pct) / 100, soft_buffer_pct: parseFloat(f.soft_buffer_pct) / 100 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-capacity-configs"] }); closeModal(); },
    onError: (e: unknown) => setApiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/squad-capacity-configs/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-capacity-configs"] }); setDeleteId(null); },
  });

  function openCreate() { setForm({ squad_id: "", role_type: "frontend_dev", hard_buffer_pct: "15", soft_buffer_pct: "10" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: CapacityRow) { setForm({ squad_id: row.squadId.toString(), role_type: row.roleType, hard_buffer_pct: (parseFloat(row.hardBufferPct) * 100).toFixed(1), soft_buffer_pct: (parseFloat(row.softBufferPct) * 100).toFixed(1) }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Config</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No capacity configs found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Squad</th><th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hard Buffer %</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Soft Buffer %</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.squad.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.roleType.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{(parseFloat(row.hardBufferPct) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{(parseFloat(row.softBufferPct) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(row)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setDeleteId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Capacity Config" : "Edit Capacity Config"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}><label style={labelStyle}>Squad *</label>
            <select style={inputStyle} required value={form.squad_id} onChange={e => setForm({ ...form, squad_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select squad —</option>
              {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}><label style={labelStyle}>Role Type *</label>
            <select style={inputStyle} value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })} disabled={modalMode === "edit"}>
              {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Hard Buffer %</label><input style={inputStyle} type="number" min="0" max="100" step="0.5" value={form.hard_buffer_pct} onChange={e => setForm({ ...form, hard_buffer_pct: e.target.value })} /></div>
            <div><label style={labelStyle}>Soft Buffer %</label><input style={inputStyle} type="number" min="0" max="100" step="0.5" value={form.soft_buffer_pct} onChange={e => setForm({ ...form, soft_buffer_pct: e.target.value })} /></div>
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
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete config?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This is permanent.</p>
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

export function WorkforceTab() {
  const [sub, setSub] = useState<SubTab>("squads");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "squads", label: "Squads" },
    { id: "persons", label: "Persons" },
    { id: "memberships", label: "Squad Memberships" },
    { id: "roles", label: "Person Roles" },
    { id: "capacity", label: "Capacity Configs" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>
        ))}
      </div>
      {sub === "squads" && <SquadsTab />}
      {sub === "persons" && <PersonsTab />}
      {sub === "memberships" && <MembershipsSection />}
      {sub === "roles" && <PersonRolesSection />}
      {sub === "capacity" && <CapacityConfigSection />}
    </div>
  );
}
