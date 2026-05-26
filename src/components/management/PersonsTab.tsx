"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";

interface SquadOption {
  id: number;
  name: string;
}

interface PersonRecord {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  employmentType: string;
  weeklyCapacityHours: string;
  tempoAccountId: string | null;
  costPerHour: string | null;
  squadMemberships: Array<{
    id: number;
    squadId: number;
    allocationPct: string;
    squad: { id: number; name: string };
  }>;
}

interface FormState {
  name: string;
  email: string;
  employment_type: string;
  weekly_capacity_hours: string;
  tempo_account_id: string;
  cost_per_hour: string;
  squad_id: string;
  allocation_pct: string;
}

const defaultForm: FormState = {
  name: "",
  email: "",
  employment_type: "dedicated",
  weekly_capacity_hours: "40",
  tempo_account_id: "",
  cost_per_hour: "",
  squad_id: "",
  allocation_pct: "100",
};

const thStyle: React.CSSProperties = {
  padding: "9px 14px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg)",
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  fontSize: 14,
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

const fieldStyle: React.CSSProperties = { marginBottom: 18 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 };

export function PersonsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<PersonRecord | null>(null);
  const [archiving, setArchiving] = useState<PersonRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const qc = useQueryClient();

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["mgmt-persons", showArchived],
    queryFn: () =>
      api
        .get<PersonRecord[]>(`/management/persons?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });

  const { data: squads = [] } = useQuery({
    queryKey: ["mgmt-squads-active"],
    queryFn: () =>
      api.get<SquadOption[]>("/management/squads").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api
        .post("/management/persons", {
          name: f.name,
          email: f.email,
          employment_type: f.employment_type,
          weekly_capacity_hours: parseFloat(f.weekly_capacity_hours) || 40,
          tempo_account_id: f.tempo_account_id || null,
          cost_per_hour: f.cost_per_hour ? parseFloat(f.cost_per_hour) : null,
          squad_id: f.squad_id ? Number(f.squad_id) : null,
          allocation_pct: f.squad_id ? parseFloat(f.allocation_pct) / 100 : undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-persons"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      api
        .patch(`/management/persons/${id}`, {
          name: f.name,
          email: f.email,
          employment_type: f.employment_type,
          weekly_capacity_hours: parseFloat(f.weekly_capacity_hours) || 40,
          tempo_account_id: f.tempo_account_id || null,
          cost_per_hour: f.cost_per_hour ? parseFloat(f.cost_per_hour) : null,
          squad_id: f.squad_id ? Number(f.squad_id) : null,
          allocation_pct: f.squad_id ? parseFloat(f.allocation_pct) / 100 : undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-persons"] });
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
      closeModal();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/persons/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-persons"] });
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
      setArchiving(null);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/persons/${id}/unarchive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-persons"] });
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setEditing(null);
    setModalMode("create");
  }

  function openEdit(person: PersonRecord) {
    const currentSquad = person.squadMemberships[0];
    setForm({
      name: person.name,
      email: person.email,
      employment_type: person.employmentType,
      weekly_capacity_hours: parseFloat(person.weeklyCapacityHours).toString(),
      tempo_account_id: person.tempoAccountId ?? "",
      cost_per_hour: person.costPerHour ? parseFloat(person.costPerHour).toString() : "",
      squad_id: currentSquad?.squadId?.toString() ?? "",
      allocation_pct: currentSquad
        ? (parseFloat(currentSquad.allocationPct) * 100).toString()
        : "100",
    });
    setEditing(person);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modalMode === "create") createMutation.mutate(form);
    else if (modalMode === "edit" && editing) updateMutation.mutate({ id: editing.id, f: form });
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={() => setShowArchived(!showArchived)}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: showArchived ? "var(--primary-light)" : "var(--bg)",
            color: showArchived ? "var(--primary)" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: showArchived ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {showArchived ? "Hide Archived" : "Show Archived"}
        </button>
        <button
          onClick={openCreate}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Person
        </button>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</p>
        ) : persons.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No persons found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Squad</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hrs/wk</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {persons.map((person, i) => {
                const squad = person.squadMemberships[0];
                return (
                  <tr
                    key={person.id}
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                  >
                    <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>
                      {person.name}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                      {person.email}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 99,
                          background: person.employmentType === "dedicated"
                            ? "rgba(37,99,235,0.08)"
                            : "rgba(245,158,11,0.1)",
                          color: person.employmentType === "dedicated"
                            ? "var(--primary)"
                            : "#d97706",
                          fontWeight: 600,
                        }}
                      >
                        {person.employmentType}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                      {squad
                        ? `${squad.squad.name} (${(parseFloat(squad.allocationPct) * 100).toFixed(0)}%)`
                        : "—"}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right" }}>
                      {parseFloat(person.weeklyCapacityHours).toFixed(0)}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: person.isActive ? "var(--safe-bg)" : "var(--border)",
                          color: person.isActive ? "var(--safe)" : "var(--text-muted)",
                        }}
                      >
                        {person.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(person)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "var(--bg)",
                            fontSize: 12,
                            cursor: "pointer",
                            color: "var(--text)",
                          }}
                        >
                          Edit
                        </button>
                        {person.isActive ? (
                          <button
                            onClick={() => setArchiving(person)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "1px solid var(--critical)",
                              background: "transparent",
                              color: "var(--critical)",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => unarchiveMutation.mutate(person.id)}
                            disabled={unarchiveMutation.isPending}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "1px solid var(--safe)",
                              background: "transparent",
                              color: "var(--safe)",
                              fontSize: 12,
                              cursor: unarchiveMutation.isPending ? "not-allowed" : "pointer",
                              opacity: unarchiveMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            Unarchive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ManagementModal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Person" : `Edit Person — ${editing?.name}`}
      >
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Employment Type</label>
              <select
                style={inputStyle}
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
              >
                <option value="dedicated">Dedicated</option>
                <option value="shared">Shared</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Weekly Hours</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                max="80"
                step="0.5"
                value={form.weekly_capacity_hours}
                onChange={(e) => setForm({ ...form, weekly_capacity_hours: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Tempo Account ID</label>
              <input
                style={inputStyle}
                type="text"
                value={form.tempo_account_id}
                onChange={(e) => setForm({ ...form, tempo_account_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label style={labelStyle}>Cost / Hour</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                value={form.cost_per_hour}
                onChange={(e) => setForm({ ...form, cost_per_hour: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 18,
              marginBottom: 18,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: "var(--text-muted)" }}>
              Squad Assignment
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Squad</label>
              <select
                style={inputStyle}
                value={form.squad_id}
                onChange={(e) => setForm({ ...form, squad_id: e.target.value })}
              >
                <option value="">— No squad —</option>
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {form.squad_id && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Allocation %</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.allocation_pct}
                  onChange={(e) => setForm({ ...form, allocation_pct: e.target.value })}
                />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={closeModal}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </ManagementModal>

      <ArchiveConfirmDialog
        isOpen={archiving !== null}
        entityName={archiving?.name ?? ""}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}
