"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";

type SubTab = "categories" | "mappings" | "entries";

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

const NB_TYPES = ["shared_ceremony", "leave", "internal_meeting", "training", "company"];

interface NbCategoryRow {
  id: number;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  _count: { entries: number; sourceMappings: number };
}

interface SourceMappingRow {
  id: number;
  categoryId: number;
  source: string;
  identifierType: string;
  identifierValue: string;
  category: { id: number; name: string };
}

interface EntryRow {
  id: number;
  personId: number;
  categoryId: number;
  month: string;
  hours: string;
  source: string;
  person: { id: number; name: string };
  category: { id: number; name: string };
}

function CategoriesSection() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<NbCategoryRow | null>(null);
  const [form, setForm] = useState({ name: "", type: "internal_ceremony", description: "" });
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-categories", showArchived],
    queryFn: () =>
      api.get<NbCategoryRow[]>(`/management/nonbillable-categories?includeArchived=${showArchived}`).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api.post("/management/nonbillable-categories", { name: f.name, type: f.type, description: f.description || undefined }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) =>
      api.patch(`/management/nonbillable-categories/${id}`, { name: f.name, type: f.type, description: f.description || undefined }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/nonbillable-categories/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] }); setArchiveId(null); },
  });

  function openCreate() { setForm({ name: "", type: "internal_ceremony", description: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: NbCategoryRow) { setForm({ name: row.name, type: row.type, description: row.description ?? "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setApiError(null);
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={() => setShowArchived(!showArchived)}
          style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--border)", background: showArchived ? "var(--primary-light)" : "var(--bg)", color: showArchived ? "var(--primary)" : "var(--text-muted)", fontSize: 13, fontWeight: showArchived ? 600 : 400, cursor: "pointer" }}
        >
          {showArchived ? "Hide Archived" : "Show Archived"}
        </button>
        <button
          onClick={openCreate}
          style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Add Category
        </button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No categories found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Entries</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Source Mappings</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", opacity: row.isActive ? 1 : 0.6 }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.type.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.description ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{row._count.entries}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{row._count.sourceMappings}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: row.isActive ? "var(--safe-bg)" : "var(--border)", color: row.isActive ? "var(--safe)" : "var(--text-muted)" }}>
                      {row.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    {row.isActive && (
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(row)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer", color: "var(--text)" }}>Edit</button>
                        <button onClick={() => setArchiveId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Archive</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Category" : `Edit Category — ${editing?.name}`}>
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Category name" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Type *</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {NB_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
          </div>
        </form>
      </ManagementModal>

      {archiveId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setArchiveId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Archive category?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This will hide it from future entries.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setArchiveId(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => archiveMutation.mutate(archiveId!)} disabled={archiveMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: archiveMutation.isPending ? "not-allowed" : "pointer", opacity: archiveMutation.isPending ? 0.7 : 1 }}>{archiveMutation.isPending ? "Archiving…" : "Archive"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceMappingsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [form, setForm] = useState({ category_id: "", source: "", identifier_type: "", identifier_value: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-source-mappings"],
    queryFn: () => api.get<SourceMappingRow[]>("/management/nonbillable-source-mappings").then(r => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["mgmt-nb-categories"],
    queryFn: () => api.get<NbCategoryRow[]>("/management/nonbillable-categories").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api.post("/management/nonbillable-source-mappings", { category_id: Number(f.category_id), source: f.source, identifier_type: f.identifier_type, identifier_value: f.identifier_value }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-nb-source-mappings"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/nonbillable-source-mappings/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-nb-source-mappings"] }); setDeleteId(null); },
  });

  function openCreate() { setForm({ category_id: "", source: "", identifier_type: "", identifier_value: "" }); setApiError(null); setModalMode("create"); }
  function closeModal() { setModalMode(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setApiError(null);
    createMutation.mutate(form);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Mapping</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No source mappings found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Source / Type</th>
                <th style={thStyle}>Identifier Value</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.category.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.source} / {row.identifierType}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.identifierValue}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <button onClick={() => setDeleteId(row.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title="Add Source Mapping">
        <form onSubmit={handleSubmit}>
          {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
          <div style={fieldStyle}>
            <label style={labelStyle}>Category *</label>
            <select style={inputStyle} required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— Select category —</option>
              {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Source *</label>
            <select style={inputStyle} required value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              <option value="">— Select source —</option>
              <option value="tempo">Tempo</option>
              <option value="jira_na">Jira NA</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Identifier Type *</label>
            <select style={inputStyle} required value={form.identifier_type} onChange={e => setForm({ ...form, identifier_type: e.target.value })}>
              <option value="">— Select type —</option>
              <option value="issue_key">Issue Key (ex: MP-XXXX)</option>
              <option value="account_key"> Account Key</option>
              <option value="component_key">Component Key</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Identifier Value *</label>
            <input style={inputStyle} type="text" required value={form.identifier_value} onChange={e => setForm({ ...form, identifier_value: e.target.value })} placeholder="e.g. CAAS-001" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.7 : 1 }}>{createMutation.isPending ? "Saving…" : "Create"}</button>
          </div>
        </form>
      </ManagementModal>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setDeleteId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete mapping?</div>
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

function EntriesSection() {
  const [personFilter, setPersonFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [submitted, setSubmitted] = useState({ person: "", month: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-entries", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.person) params.personName = submitted.person;
      if (submitted.month) params.month = submitted.month;
      return api.get<EntryRow[]>("/management/nonbillable-entries", { params }).then(r => r.data);
    },
  });

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({ person: personFilter, month: monthFilter });
  }

  return (
    <div>
      <form onSubmit={handleApply} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Person name</label>
          <input style={{ ...inputStyle, width: 200 }} type="text" value={personFilter} onChange={e => setPersonFilter(e.target.value)} placeholder="Filter by name" />
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Month</label>
          <input style={{ ...inputStyle, width: 160 }} type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
        </div>
        <button type="submit" style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Apply</button>
      </form>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No entries found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Month</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hours</th>
                <th style={thStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.person.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.category.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.month?.split("T")[0] ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>{parseFloat(row.hours).toFixed(1)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function NonBillableTab() {
  const [sub, setSub] = useState<SubTab>("categories");
  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "categories", label: "Categories" },
    { id: "mappings", label: "Source Mappings" },
    { id: "entries", label: "Entries" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subTabBtn(sub === t.id)}>{t.label}</button>
        ))}
      </div>
      {sub === "categories" && <CategoriesSection />}
      {sub === "mappings" && <SourceMappingsSection />}
      {sub === "entries" && <EntriesSection />}
    </div>
  );
}
