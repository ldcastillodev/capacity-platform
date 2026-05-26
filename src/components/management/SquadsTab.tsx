"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";

interface PersonOption {
  id: number;
  name: string;
  isActive: boolean;
}

interface SquadRecord {
  id: number;
  name: string;
  isActive: boolean;
  lead: { id: number; name: string } | null;
  members: { id: number }[];
}

interface FormState {
  name: string;
  lead_person_id: string;
}

const defaultForm: FormState = { name: "", lead_person_id: "" };

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

export function SquadsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SquadRecord | null>(null);
  const [archiving, setArchiving] = useState<SquadRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const qc = useQueryClient();

  const { data: squads = [], isLoading } = useQuery({
    queryKey: ["mgmt-squads", showArchived],
    queryFn: () =>
      api
        .get<SquadRecord[]>(`/management/squads?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });

  const { data: persons = [] } = useQuery({
    queryKey: ["mgmt-persons-active"],
    queryFn: () =>
      api.get<PersonOption[]>("/management/persons").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api
        .post("/management/squads", {
          name: f.name,
          lead_person_id: f.lead_person_id ? Number(f.lead_person_id) : null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      api
        .patch(`/management/squads/${id}`, {
          name: f.name,
          lead_person_id: f.lead_person_id ? Number(f.lead_person_id) : null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
      closeModal();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/squads/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
      setArchiving(null);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/squads/${id}/unarchive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-squads"] });
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setEditing(null);
    setModalMode("create");
  }

  function openEdit(squad: SquadRecord) {
    setForm({ name: squad.name, lead_person_id: squad.lead?.id?.toString() ?? "" });
    setEditing(squad);
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
          + Add Squad
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
        ) : squads.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No squads found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Lead</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Active Members</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {squads.map((squad, i) => (
                <tr
                  key={squad.id}
                  style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                >
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>
                    {squad.name}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 14, color: "var(--text-muted)" }}>
                    {squad.lead?.name ?? "—"}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>
                    {squad.members.length}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: squad.isActive ? "var(--safe-bg)" : "var(--border)",
                        color: squad.isActive ? "var(--safe)" : "var(--text-muted)",
                      }}
                    >
                      {squad.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEdit(squad)}
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
                      {squad.isActive ? (
                        <button
                          onClick={() => setArchiving(squad)}
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
                          onClick={() => unarchiveMutation.mutate(squad.id)}
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManagementModal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Squad" : `Edit Squad — ${editing?.name}`}
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
              placeholder="Squad name"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Lead Person</label>
            <select
              style={inputStyle}
              value={form.lead_person_id}
              onChange={(e) => setForm({ ...form, lead_person_id: e.target.value })}
            >
              <option value="">— No lead —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
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
