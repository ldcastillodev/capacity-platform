"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";

interface ClientRecord {
  id: number;
  name: string;
  region: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  retainerContracts: { id: number }[];
}

interface FormState {
  name: string;
  region: string;
  currency: string;
}

const defaultForm: FormState = { name: "", region: "na", currency: "USD" };

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

export function ClientsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [archiving, setArchiving] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["mgmt-clients", showArchived],
    queryFn: () =>
      api
        .get<ClientRecord[]>(`/management/clients?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api.post("/management/clients", f).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-clients"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      api.patch(`/management/clients/${id}`, f).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-clients"] });
      closeModal();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/clients/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-clients"] });
      setArchiving(null);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/clients/${id}/unarchive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-clients"] });
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setEditing(null);
    setModalMode("create");
  }

  function openEdit(client: ClientRecord) {
    setForm({ name: client.name, region: client.region, currency: client.currency });
    setEditing(client);
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
          + Add Client
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
        ) : clients.length === 0 ? (
          <p style={{ padding: 24, color: "var(--text-muted)" }}>No clients found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Region</th>
                <th style={thStyle}>Currency</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Contracts</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => (
                <tr
                  key={client.id}
                  style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                >
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>
                    {client.name}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 99,
                        background: client.region === "na"
                          ? "rgba(59,130,246,0.08)"
                          : "rgba(99,102,241,0.08)",
                        color: client.region === "na" ? "#2563eb" : "#6366f1",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {client.region}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                    {client.currency}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>
                    {client.retainerContracts.length}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: client.isActive ? "var(--safe-bg)" : "var(--border)",
                        color: client.isActive ? "var(--safe)" : "var(--text-muted)",
                      }}
                    >
                      {client.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEdit(client)}
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
                      {client.isActive ? (
                        <button
                          onClick={() => setArchiving(client)}
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
                          onClick={() => unarchiveMutation.mutate(client.id)}
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
        title={modalMode === "create" ? "Add Client" : `Edit Client — ${editing?.name}`}
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
              placeholder="Client name"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Region *</label>
              <select
                style={inputStyle}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                <option value="na">NA</option>
                <option value="emea">EMEA</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Currency *</label>
              <select
                style={inputStyle}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
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
