"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";

type SubTab = "billing-rates" | "cost-rates" | "te-config" | "access";

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

function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

const ROLE_TYPES = ["frontend_dev","backend_dev","fullstack_dev","devops","qa","ux_designer","product_manager","project_manager","tech_lead","solutions_architect","data_engineer","scrum_master","business_analyst","seo","content_author","client_services"];
const CURRENCIES = ["USD", "GBP", "EUR"];
const TE_BILLING_TYPES = ["same_rate", "premium_flat", "premium_pct", "blended_rate", "per_role"];

interface ClientOption { id: number; name: string }
interface PersonOption { id: number; name: string }

interface BillingRateRow {
  id: number; clientId: number; roleType: string | null; ratePerHour: string;
  currency: string; effectiveFrom: string; effectiveTo: string | null;
  client: { id: number; name: string };
}

function BillingRatesSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [form, setForm] = useState({ client_id: "", role_type: "", rate_per_hour: "", currency: "USD", effective_from: new Date().toISOString().split("T")[0], effective_to: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-billing-rates"],
    queryFn: () => api.get<BillingRateRow[]>("/management/billing-rates").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/billing-rates", {
      client_id: Number(f.client_id),
      role_type: f.role_type || undefined,
      rate_per_hour: f.rate_per_hour,
      currency: f.currency,
      effective_from: f.effective_from,
      effective_to: f.effective_to || undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-billing-rates"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/billing-rates/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-billing-rates"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", role_type: "", rate_per_hour: "", currency: "USD", effective_from: new Date().toISOString().split("T")[0], effective_to: "" }); setApiError(null); setModalMode("create"); }
  function closeModal() { setModalMode(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); createMutation.mutate(form); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Billing Rate</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No billing rates found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate/hr</th>
                <th style={thStyle}>Currency</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.roleType ? row.roleType.replace(/_/g, " ") : "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row.ratePerHour}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.currency}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <button onClick={() => { setDeleteId(row.id); setDeleteError(null); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title="Add Billing Rate">
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Client *</label>
            <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })}>
              <option value="">—</option>
              {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Rate per Hour *</label><input style={inputStyle} type="number" step="0.01" min="0" required value={form.rate_per_hour} onChange={e => setForm({ ...form, rate_per_hour: e.target.value })} /></div>
            <div><label style={labelStyle}>Currency *</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>From *</label><input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} /></div>
            <div><label style={labelStyle}>To</label><input style={inputStyle} type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.7 : 1 }}>{createMutation.isPending ? "Saving…" : "Create"}</button>
          </div>
        </form>
      </ManagementModal>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 420, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete billing rate?</div>
            {deleteError
              ? <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 16 }}>{deleteError}</p>
              : <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This action is permanent and cannot be undone.</p>
            }
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              {!deleteError && <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CostRateRow {
  id: number; personId: number | null; roleType: string | null; ratePerHour: string;
  currency: string; effectiveFrom: string; effectiveTo: string | null;
  person: { id: number; name: string } | null;
}

function CostRatesSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [form, setForm] = useState({ person_id: "", role_type: "", rate_per_hour: "", currency: "USD", effective_from: new Date().toISOString().split("T")[0], effective_to: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-cost-rates"],
    queryFn: () => api.get<CostRateRow[]>("/management/cost-rates").then(r => r.data),
  });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/cost-rates", {
      person_id: f.person_id ? Number(f.person_id) : undefined,
      role_type: f.role_type || undefined,
      rate_per_hour: f.rate_per_hour,
      currency: f.currency,
      effective_from: f.effective_from,
      effective_to: f.effective_to || undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cost-rates"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/cost-rates/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cost-rates"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function openCreate() { setForm({ person_id: "", role_type: "", rate_per_hour: "", currency: "USD", effective_from: new Date().toISOString().split("T")[0], effective_to: "" }); setApiError(null); setModalMode("create"); }
  function closeModal() { setModalMode(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); createMutation.mutate(form); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Cost Rate</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No cost rates found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate/hr</th>
                <th style={thStyle}>Currency</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.person ? row.person.name : "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.roleType ? row.roleType.replace(/_/g, " ") : "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row.ratePerHour}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.currency}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <button onClick={() => { setDeleteId(row.id); setDeleteError(null); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title="Add Cost Rate">
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Person</label>
            <select style={inputStyle} value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })}>
              <option value="">—</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })}>
              <option value="">—</option>
              {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Rate per Hour *</label><input style={inputStyle} type="number" step="0.01" min="0" required value={form.rate_per_hour} onChange={e => setForm({ ...form, rate_per_hour: e.target.value })} /></div>
            <div><label style={labelStyle}>Currency *</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>From *</label><input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} /></div>
            <div><label style={labelStyle}>To</label><input style={inputStyle} type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.7 : 1 }}>{createMutation.isPending ? "Saving…" : "Create"}</button>
          </div>
        </form>
      </ManagementModal>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 420, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete cost rate?</div>
            {deleteError
              ? <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 16 }}>{deleteError}</p>
              : <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This action is permanent and cannot be undone.</p>
            }
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              {!deleteError && <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TEConfigRow {
  id: number; clientId: number; type: string; value: string | null; currency: string | null;
  client: { id: number; name: string }; _count: { roleRates: number };
}
interface TERoleRateRow {
  id: number; teBillingConfigId: number; roleType: string; ratePerHour: string; currency: string;
}

function TEConfigRoleRatesModal({ configId, configType, onClose }: { configId: number; configType: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [rrForm, setRrForm] = useState({ role_type: "frontend_dev", rate_per_hour: "", currency: "USD" });
  const [rrDeleteId, setRrDeleteId] = useState<number | null>(null);
  const [rrDeleteConfirm, setRrDeleteConfirm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: roleRates = [], isLoading } = useQuery({
    queryKey: ["mgmt-te-role-rates", configId],
    queryFn: () => api.get<TERoleRateRow[]>(`/management/te-billing-configs/${configId}/role-rates`).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (f: typeof rrForm) => api.post(`/management/te-billing-configs/${configId}/role-rates`, { role_type: f.role_type, rate_per_hour: f.rate_per_hour, currency: f.currency }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-te-role-rates", configId] }); qc.invalidateQueries({ queryKey: ["mgmt-te-configs"] }); setRrForm({ role_type: "frontend_dev", rate_per_hour: "", currency: "USD" }); setAddError(null); },
    onError: (e: unknown) => setAddError(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (rrId: number) => api.delete(`/management/te-billing-configs/${configId}/role-rates/${rrId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-te-role-rates", configId] }); qc.invalidateQueries({ queryKey: ["mgmt-te-configs"] }); setRrDeleteId(null); setRrDeleteConfirm(false); },
  });

  void configType;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 560, maxWidth: "90vw", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Role Rates</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ marginBottom: 20, padding: 16, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {addError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 12 }}>{addError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label style={labelStyle}>Role *</label>
              <select style={inputStyle} value={rrForm.role_type} onChange={e => setRrForm({ ...rrForm, role_type: e.target.value })}>
                {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Rate/hr *</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={rrForm.rate_per_hour} onChange={e => setRrForm({ ...rrForm, rate_per_hour: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Currency *</label>
              <select style={inputStyle} value={rrForm.currency} onChange={e => setRrForm({ ...rrForm, currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={() => { if (!rrForm.rate_per_hour) return; setAddError(null); addMutation.mutate(rrForm); }} disabled={addMutation.isPending || !rrForm.rate_per_hour} style={{ padding: "9px 14px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: addMutation.isPending ? "not-allowed" : "pointer", opacity: addMutation.isPending ? 0.7 : 1, whiteSpace: "nowrap" }}>Add</button>
          </div>
        </div>

        {isLoading ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
          : roleRates.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No role rates yet.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate/hr</th>
                <th style={thStyle}>Currency</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{roleRates.map((rr, i) => (
                <tr key={rr.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{rr.roleType.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{rr.ratePerHour}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{rr.currency}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <button onClick={() => { setRrDeleteId(rr.id); setRrDeleteConfirm(true); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}

        {rrDeleteConfirm && rrDeleteId !== null && (
          <div style={{ marginTop: 20, padding: 16, background: "var(--critical-bg)", border: "1px solid var(--critical)", borderRadius: 8 }}>
            <p style={{ fontSize: 14, marginBottom: 12, color: "var(--critical)" }}>Delete this role rate?</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRrDeleteId(null); setRrDeleteConfirm(false); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(rrDeleteId)} disabled={deleteMutation.isPending} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TEBillingConfigSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<TEConfigRow | null>(null);
  const [form, setForm] = useState({ client_id: "", type: "same_rate", value: "", currency: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rrConfigId, setRrConfigId] = useState<number | null>(null);
  const [rrConfigType, setRrConfigType] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-te-configs"],
    queryFn: () => api.get<TEConfigRow[]>("/management/te-billing-configs").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/te-billing-configs", {
      client_id: Number(f.client_id),
      type: f.type,
      value: f.value || undefined,
      currency: f.currency || undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-te-configs"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/te-billing-configs/${id}`, {
      type: f.type,
      value: f.value || undefined,
      currency: f.currency || undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-te-configs"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/te-billing-configs/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-te-configs"] }); setDeleteId(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", type: "same_rate", value: "", currency: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: TEConfigRow) { setForm({ client_id: row.clientId.toString(), type: row.type, value: row.value ?? "", currency: row.currency ?? "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add TE Config</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No TE billing configs found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
                <th style={thStyle}>Currency</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Role Rates</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.type.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row.value ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.currency ?? "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <button onClick={() => { setRrConfigId(row.id); setRrConfigType(row.type); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>
                      {row._count.roleRates > 0 ? `${row._count.roleRates} rate${row._count.roleRates !== 1 ? "s" : ""}` : "Manage"}
                    </button>
                  </td>
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

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add TE Billing Config" : "Edit TE Billing Config"}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Client *</label>
            <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} disabled={modalMode === "edit"}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Type *</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TE_BILLING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div><label style={labelStyle}>Value</label><input style={inputStyle} type="number" step="0.01" min="0" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
            <div><label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="">—</option>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
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
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete TE config?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This action is permanent and cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {rrConfigId !== null && rrConfigType !== null && (
        <TEConfigRoleRatesModal configId={rrConfigId} configType={rrConfigType} onClose={() => { setRrConfigId(null); setRrConfigType(null); }} />
      )}
    </div>
  );
}

interface AccessRow {
  id: number; clientId: number; personId: number; grantedAt: string;
  grantedBy: number | null; revokedAt: string | null;
  client: { id: number; name: string }; person: { id: number; name: string };
}

function ClientPersonAccessSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [form, setForm] = useState({ client_id: "", person_id: "", granted_by: "" });
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-client-access"],
    queryFn: () => api.get<AccessRow[]>("/management/client-person-access").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/client-person-access", {
      client_id: Number(f.client_id),
      person_id: Number(f.person_id),
      granted_by: f.granted_by ? Number(f.granted_by) : undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-client-access"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/client-person-access/${id}/revoke`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-client-access"] }); setRevokeId(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", person_id: "", granted_by: "" }); setApiError(null); setModalMode("create"); }
  function closeModal() { setModalMode(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); createMutation.mutate(form); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Grant Access</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No access records found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Granted At</th>
                <th style={thStyle}>Revoked At</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14 }}>{row.person.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.grantedAt.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>
                    {row.revokedAt
                      ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--critical-bg)", color: "var(--critical)" }}>Revoked</span>
                      : "—"
                    }
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    {!row.revokedAt && (
                      <button onClick={() => setRevokeId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title="Grant Client Access">
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Client *</label>
            <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Person *</label>
            <select style={inputStyle} required value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })}>
              <option value="">— Select person —</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Granted By</label>
            <select style={inputStyle} value={form.granted_by} onChange={e => setForm({ ...form, granted_by: e.target.value })}>
              <option value="">—</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.7 : 1 }}>{createMutation.isPending ? "Saving…" : "Grant"}</button>
          </div>
        </form>
      </ManagementModal>

      {revokeId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setRevokeId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Revoke access?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This will revoke the person&apos;s access to this client.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setRevokeId(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => revokeMutation.mutate(revokeId!)} disabled={revokeMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: revokeMutation.isPending ? "not-allowed" : "pointer", opacity: revokeMutation.isPending ? 0.7 : 1 }}>{revokeMutation.isPending ? "Revoking…" : "Revoke"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BillingTab() {
  const [sub, setSub] = useState<SubTab>("billing-rates");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "billing-rates", label: "Billing Rates" },
    { id: "cost-rates", label: "Cost Rates" },
    { id: "te-config", label: "TE Config" },
    { id: "access", label: "Client Access" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>
        ))}
      </div>
      {sub === "billing-rates" && <BillingRatesSection />}
      {sub === "cost-rates" && <CostRatesSection />}
      {sub === "te-config" && <TEBillingConfigSection />}
      {sub === "access" && <ClientPersonAccessSection />}
    </div>
  );
}
