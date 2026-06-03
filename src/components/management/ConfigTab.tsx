"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";

type SubTab = "tempo-mappings";

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
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 };

function subTabBtn(active: boolean): React.CSSProperties {
  return { padding: "7px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`, marginBottom: -1, borderRadius: 0 };
}

function errMsg(e: unknown) { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e); }

interface ClientOption { id: number; name: string }

// ─── Tempo Mappings ───────────────────────────────────────────────────────────

interface TempoMappingRow { id: number; clientId: number; accountKey: string; effectiveFrom: string; effectiveTo: string | null; client: { id: number; name: string } }

function TempoMappingsSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ client_id: "", account_key: "", effective_from: new Date().toISOString().split("T")[0] });
  const [apiError, setApiError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-tempo-mappings"],
    queryFn: () => api.get<TempoMappingRow[]>("/management/tempo-mappings").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["mgmt-clients"],
    queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/tempo-mappings", { client_id: Number(f.client_id), account_key: f.account_key, effective_from: f.effective_from }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-tempo-mappings"] }); setForm({ client_id: "", account_key: "", effective_from: new Date().toISOString().split("T")[0] }); setApiError(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/tempo-mappings/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-tempo-mappings"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function handleCreate(e: React.FormEvent) { e.preventDefault(); setApiError(null); createMut.mutate(form); }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, padding: "10px 14px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
        Note: Jira component ↔ client mappings are managed in the Components tab.
      </p>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, padding: "14px 16px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
        {apiError && <p style={{ color: "var(--critical)", fontSize: 13, width: "100%", margin: 0 }}>{apiError}</p>}
        <div style={{ flex: 2 }}>
          <label style={{ ...labelStyle, fontSize: 12 }}>Client *</label>
          <select style={inputStyle} required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
            <option value="">— Select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ ...labelStyle, fontSize: 12 }}>Account Key *</label>
          <input style={inputStyle} type="text" required value={form.account_key} onChange={e => setForm({ ...form, account_key: e.target.value })} placeholder="e.g. ACC-123" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 12 }}>Effective From *</label>
          <input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} />
        </div>
        <button type="submit" disabled={createMut.isPending} style={{ padding: "9px 14px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add Mapping</button>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No Tempo mappings found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Account Key</th>
                <th style={thStyle}>Effective From</th>
                <th style={thStyle}>Effective To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>{row.accountKey}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom?.split("T")[0] ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo?.split("T")[0] ?? "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <button onClick={() => { setDeleteId(row.id); setDeleteError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 360, maxWidth: "90vw" }}>
            {deleteError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{deleteError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete Tempo Mapping?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This Tempo account mapping will be permanently deleted.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMut.isPending ? "not-allowed" : "pointer", opacity: deleteMut.isPending ? 0.7 : 1 }}>
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ConfigTab() {
  const [subTab, setSubTab] = useState<SubTab>("tempo-mappings");

  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {(["tempo-mappings"] as SubTab[]).map(t => (
          <button key={t} style={subTabBtn(subTab === t)} onClick={() => setSubTab(t)}>
            {t === "tempo-mappings" ? "Tempo Mappings" : t}
          </button>
        ))}
      </div>
      {subTab === "tempo-mappings" && <TempoMappingsSection />}
    </div>
  );
}
