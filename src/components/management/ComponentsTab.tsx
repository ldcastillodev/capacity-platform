"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";

interface ClientOption {
  id: number;
  name: string;
}

interface ComponentRecord {
  id: number;
  jiraInstance: string;
  componentKey: string;
  clientId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  client: { id: number; name: string };
}

interface FormState {
  jira_instance: string;
  component_key: string;
  client_id: string;
  effective_from: string;
}

const defaultForm: FormState = {
  jira_instance: "na",
  component_key: "",
  client_id: "",
  effective_from: new Date().toISOString().split("T")[0],
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

function formatDate(iso: string) {
  return iso.split("T")[0];
}

export function ComponentsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ComponentRecord | null>(null);
  const [archiving, setArchiving] = useState<ComponentRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const qc = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["mgmt-components", showArchived],
    queryFn: () =>
      api
        .get<ComponentRecord[]>(`/management/components?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["mgmt-clients-active"],
    queryFn: () =>
      api.get<ClientOption[]>("/management/clients").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api
        .post("/management/components", {
          jira_instance: f.jira_instance,
          component_key: f.component_key,
          client_id: Number(f.client_id),
          effective_from: f.effective_from,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      api
        .patch(`/management/components/${id}`, {
          jira_instance: f.jira_instance,
          client_id: Number(f.client_id),
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      closeModal();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/components/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      setArchiving(null);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/components/${id}/unarchive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setEditing(null);
    setModalMode("create");
  }

  function openEdit(comp: ComponentRecord) {
    setForm({
      jira_instance: comp.jiraInstance,
      component_key: comp.componentKey,
      client_id: comp.clientId.toString(),
      effective_from: formatDate(comp.effectiveFrom),
    });
    setEditing(comp);
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
            color: "#FDFDFD",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Mapping
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
        ) : components.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No component mappings found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Jira Instance</th>
                <th style={thStyle}>Component Key</th>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Effective From</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {components.map((comp, i) => {
                const isActive = comp.effectiveTo === null || new Date(comp.effectiveTo) > new Date();
                return (
                  <tr
                    key={comp.id}
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                  >
                    <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {comp.jiraInstance}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, fontFamily: "monospace" }}>
                      {comp.componentKey}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 14 }}>
                      {comp.client.name}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                      {formatDate(comp.effectiveFrom)}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: isActive ? "var(--safe-bg)" : "var(--border)",
                          color: isActive ? "var(--safe)" : "var(--text-muted)",
                        }}
                      >
                        {isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(comp)}
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
                        {isActive ? (
                          <button
                            onClick={() => setArchiving(comp)}
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
                            onClick={() => unarchiveMutation.mutate(comp.id)}
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
        title={
          modalMode === "create"
            ? "Add Component Mapping"
            : `Edit Mapping — ${editing?.componentKey}`
        }
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Jira Instance</label>
              <input
                style={inputStyle}
                type="text"
                value={form.jira_instance}
                onChange={(e) => setForm({ ...form, jira_instance: e.target.value })}
                placeholder="na"
              />
            </div>
            <div>
              <label style={labelStyle}>Component Key *</label>
              <input
                style={{
                  ...inputStyle,
                  background: modalMode === "edit" ? "var(--bg)" : "var(--surface)",
                  color: modalMode === "edit" ? "var(--text-muted)" : "var(--text)",
                }}
                type="text"
                required
                value={form.component_key}
                onChange={(e) => setForm({ ...form, component_key: e.target.value })}
                disabled={modalMode === "edit"}
                placeholder="e.g. MG-001"
              />
              {modalMode === "edit" && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Component key is immutable after creation.
                </p>
              )}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Client *</label>
            <select
              style={inputStyle}
              required
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Effective From *</label>
            <input
              style={{
                ...inputStyle,
                background: modalMode === "edit" ? "var(--bg)" : "var(--surface)",
                color: modalMode === "edit" ? "var(--text-muted)" : "var(--text)",
              }}
              type="date"
              required
              value={form.effective_from}
              onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
              disabled={modalMode === "edit"}
            />
            {modalMode === "edit" && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Effective date is immutable after creation.
              </p>
            )}
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
                color: "#FDFDFD",
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
        entityName={archiving?.componentKey ?? ""}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}
