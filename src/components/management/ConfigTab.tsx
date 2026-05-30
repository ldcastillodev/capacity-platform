"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";

type SubTab = "calendars" | "assignments" | "cascade-rules" | "tempo-mappings";

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

const ROLE_TYPES = ["frontend_dev", "backend_dev", "fullstack_dev", "devops", "qa", "ux_designer", "product_manager", "project_manager", "tech_lead", "solutions_architect", "data_engineer", "scrum_master", "business_analyst", "seo", "content_author", "client_services"];

interface ClientOption { id: number; name: string }
interface PersonOption { id: number; name: string }

// ─── Holiday Calendars ────────────────────────────────────────────────────────

interface CalendarRow { id: number; region: string; name: string; _count: { entries: number; personAssignments: number } }
interface EntryRow { id: number; calendarId: number; date: string; name: string }

function EntriesModal({ calId, onClose }: { calId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState({ date: "", name: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ date: "", name: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["mgmt-cal-entries", calId],
    queryFn: () => api.get<EntryRow[]>(`/management/holiday-calendars/${calId}/entries`).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (f: typeof addForm) => api.post(`/management/holiday-calendars/${calId}/entries`, { date: f.date, name: f.name }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cal-entries", calId] }); qc.invalidateQueries({ queryKey: ["mgmt-calendars"] }); setAddForm({ date: "", name: "" }); setFormError(null); },
    onError: (e: unknown) => setFormError(errMsg(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof editForm }) => api.patch(`/management/holiday-entries/${id}`, { date: f.date, name: f.name }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cal-entries", calId] }); setEditingId(null); setFormError(null); },
    onError: (e: unknown) => setFormError(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/holiday-entries/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cal-entries", calId] }); qc.invalidateQueries({ queryKey: ["mgmt-calendars"] }); setDeleteId(null); },
    onError: (e: unknown) => setFormError(errMsg(e)),
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 620, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Holiday Entries — Calendar #{calId}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>×</button>
        </div>
        {formError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{formError}</p>}

        <form
          onSubmit={e => { e.preventDefault(); createMut.mutate(addForm); }}
          style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, padding: "14px 16px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: 12 }}>Date *</label>
            <input style={inputStyle} type="date" required value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ ...labelStyle, fontSize: 12 }}>Name *</label>
            <input style={inputStyle} type="text" required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Holiday name" />
          </div>
          <button type="submit" disabled={createMut.isPending} style={{ padding: "9px 14px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
        </form>

        {isLoading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          : entries.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No holiday entries yet.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{entries.map((entry, i) => (
                <tr key={entry.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    {editingId === entry.id
                      ? <input style={{ ...inputStyle, width: 140 }} type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                      : entry.date.split("T")[0]}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 14 }}>
                    {editingId === entry.id
                      ? <input style={inputStyle} type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      : entry.name}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    {editingId === entry.id ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => updateMut.mutate({ id: entry.id, f: editForm })} disabled={updateMut.isPending} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 12, cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditingId(entry.id); setEditForm({ date: entry.date.split("T")[0], name: entry.name }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => setDeleteId(entry.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}

        {deleteId !== null && (
          <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--critical-bg)", borderRadius: 8, border: "1px solid var(--critical)" }}>
            <p style={{ fontSize: 13, color: "var(--critical)", marginBottom: 12 }}>Delete this holiday entry?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{deleteMut.isPending ? "Deleting…" : "Delete"}</button>
              <button onClick={() => setDeleteId(null)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HolidayCalendarsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<CalendarRow | null>(null);
  const [form, setForm] = useState({ region: "", name: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [entriesCalId, setEntriesCalId] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-calendars"],
    queryFn: () => api.get<CalendarRow[]>("/management/holiday-calendars").then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/holiday-calendars", { region: f.region, name: f.name }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendars"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/holiday-calendars/${id}`, { name: f.name, region: f.region }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendars"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/holiday-calendars/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendars"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function openCreate() { setForm({ region: "", name: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: CalendarRow) { setForm({ region: row.region, name: row.name }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Calendar</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No holiday calendars found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Region</th>
                <th style={thStyle}>Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Entries</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Assignments</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.region}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row._count.entries}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row._count.personAssignments}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setEntriesCalId(row.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Entries ({row._count.entries})</button>
                      <button onClick={() => { setDeleteId(row.id); setDeleteError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            {deleteError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{deleteError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete Calendar?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This will delete the calendar and all its entries. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMut.isPending ? "not-allowed" : "pointer", opacity: deleteMut.isPending ? 0.7 : 1 }}>
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {entriesCalId !== null && <EntriesModal calId={entriesCalId} onClose={() => setEntriesCalId(null)} />}

      {modalMode !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={closeModal} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "relative", width: 480, background: "var(--surface)", borderLeft: "1px solid var(--border)", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{modalMode === "create" ? "Add Holiday Calendar" : `Edit Calendar — ${editing?.name}`}</div>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <form onSubmit={handleSubmit}>
                {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Region *</label>
                  <input style={inputStyle} type="text" required value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="e.g. na, emea" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Name *</label>
                  <input style={inputStyle} type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Calendar name" />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                  <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Person Calendar Assignments ──────────────────────────────────────────────

interface AssignmentRow {
  id: number; personId: number; calendarId: number;
  effectiveFrom: string; effectiveTo: string | null;
  person: { id: number; name: string };
  calendar: { id: number; name: string; region: string };
}

function PersonCalendarAssignmentsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [form, setForm] = useState({ person_id: "", calendar_id: "", effective_from: "", effective_to: "" });
  const [editForm, setEditForm] = useState({ effective_to: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-calendar-assignments"],
    queryFn: () => api.get<AssignmentRow[]>("/management/person-calendar-assignments").then(r => r.data),
  });
  const { data: persons = [] } = useQuery({
    queryKey: ["mgmt-persons-active"],
    queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data),
  });
  const { data: calendars = [] } = useQuery({
    queryKey: ["mgmt-calendars"],
    queryFn: () => api.get<{ id: number; name: string; region: string }[]>("/management/holiday-calendars").then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/person-calendar-assignments", { person_id: Number(f.person_id), calendar_id: Number(f.calendar_id), effective_from: f.effective_from, ...(f.effective_to ? { effective_to: f.effective_to } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendar-assignments"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof editForm }) => api.patch(`/management/person-calendar-assignments/${id}`, { effective_to: f.effective_to || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendar-assignments"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/person-calendar-assignments/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-calendar-assignments"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function openCreate() { setForm({ person_id: "", calendar_id: "", effective_from: new Date().toISOString().split("T")[0], effective_to: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: AssignmentRow) { setEditForm({ effective_to: row.effectiveTo ? row.effectiveTo.split("T")[0] : "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: editForm }); }
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Assignment</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No calendar assignments found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Calendar</th>
                <th style={thStyle}>Region</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.person.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>{row.calendar.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-muted)" }}>{row.calendar.region}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveFrom.split("T")[0]}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(row)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => { setDeleteId(row.id); setDeleteError(null); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--critical)", background: "transparent", color: "var(--critical)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>

      {deleteId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw" }}>
            {deleteError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{deleteError}</p>}
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete Assignment?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This will remove the calendar assignment. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null); }} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--critical)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: deleteMut.isPending ? "not-allowed" : "pointer", opacity: deleteMut.isPending ? 0.7 : 1 }}>
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={closeModal} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "relative", width: 480, background: "var(--surface)", borderLeft: "1px solid var(--border)", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{modalMode === "create" ? "Add Calendar Assignment" : `Edit Assignment — ${editing?.person.name}`}</div>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <form onSubmit={handleSubmit}>
                {apiError && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 14 }}>{apiError}</p>}
                {modalMode === "create" ? (
                  <>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Person *</label>
                      <select style={inputStyle} required value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })}>
                        <option value="">— Select person —</option>
                        {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Calendar *</label>
                      <select style={inputStyle} required value={form.calendar_id} onChange={e => setForm({ ...form, calendar_id: e.target.value })}>
                        <option value="">— Select calendar —</option>
                        {calendars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.region})</option>)}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                      <div><label style={labelStyle}>Effective From *</label><input style={inputStyle} type="date" required value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} /></div>
                      <div><label style={labelStyle}>Effective To</label><input style={inputStyle} type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
                    </div>
                  </>
                ) : (
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Effective To</label>
                    <input style={inputStyle} type="date" value={editForm.effective_to} onChange={e => setEditForm({ effective_to: e.target.value })} />
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Clear to make open-ended (only one open-ended row per person is allowed).</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                  <button type="button" onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={isPending} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 14, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Role Cascade Rules ───────────────────────────────────────────────────────

interface CascadeRuleRow { id: number; clientId: number; triggerRole: string; dependentRole: string; ratio: string; client: { id: number; name: string } | null }

function RoleCascadeRulesSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ client_id: "", trigger_role: "frontend_dev", dependent_role: "frontend_dev", ratio: "1" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-cascade-rules"],
    queryFn: () => api.get<CascadeRuleRow[]>("/management/role-cascade-rules").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["mgmt-clients"],
    queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/role-cascade-rules", { client_id: f.client_id ? Number(f.client_id) : undefined, trigger_role: f.trigger_role, dependent_role: f.dependent_role, ratio: Number(f.ratio) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cascade-rules"] }); setForm({ client_id: "", trigger_role: "frontend_dev", dependent_role: "frontend_dev", ratio: "1" }); setApiError(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/role-cascade-rules/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-cascade-rules"] }); setDeleteId(null); setDeleteError(null); },
    onError: (e: unknown) => setDeleteError(errMsg(e)),
  });

  function handleCreate(e: React.FormEvent) { e.preventDefault(); setApiError(null); createMut.mutate(form); }

  return (
    <div>
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
          <label style={{ ...labelStyle, fontSize: 12 }}>Trigger Role *</label>
          <select style={inputStyle} value={form.trigger_role} onChange={e => setForm({ ...form, trigger_role: e.target.value })}>
            {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ ...labelStyle, fontSize: 12 }}>Dependent Role *</label>
          <select style={inputStyle} value={form.dependent_role} onChange={e => setForm({ ...form, dependent_role: e.target.value })}>
            {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 12 }}>Ratio *</label>
          <input style={inputStyle} type="number" step="0.01" min="0" required value={form.ratio} onChange={e => setForm({ ...form, ratio: e.target.value })} />
        </div>
        <button type="submit" disabled={createMut.isPending} style={{ padding: "9px 14px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add Rule</button>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
        {isLoading ? <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No cascade rules found.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Trigger Role</th>
                <th style={thStyle}>Dependent Role</th>
                <th style={thStyle}>Ratio</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>{row.client?.name ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.triggerRole.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.dependentRole.replace(/_/g, " ")}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>{row.ratio}</td>
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
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Delete Cascade Rule?</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>This cascade rule will be permanently deleted.</p>
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
  const [subTab, setSubTab] = useState<SubTab>("calendars");

  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {(["calendars", "assignments", "cascade-rules", "tempo-mappings"] as SubTab[]).map(t => (
          <button key={t} style={subTabBtn(subTab === t)} onClick={() => setSubTab(t)}>
            {t === "calendars" ? "Holiday Calendars" : t === "assignments" ? "Calendar Assignments" : t === "cascade-rules" ? "Cascade Rules" : "Tempo Mappings"}
          </button>
        ))}
      </div>
      {subTab === "calendars" && <HolidayCalendarsSection />}
      {subTab === "assignments" && <PersonCalendarAssignmentsSection />}
      {subTab === "cascade-rules" && <RoleCascadeRulesSection />}
      {subTab === "tempo-mappings" && <TempoMappingsSection />}
    </div>
  );
}
