"use client";

import React, { useEffect, useState } from "react";
import type { ColumnDef } from "./ReportTable";
import type { ClientFilters } from "./ClientsReport";
import type { PersonFilters } from "./PersonsReport";
import type { SquadFilters } from "./SquadsReport";

const ROLE_TYPES = ["dev","devops","qa","design","product","project","tl","sre","data","seo","content"];

interface BaseProps {
  open: boolean;
  onClose: () => void;
  columnDefs: ColumnDef[];
  visibleColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  squadOptions: { id: number; name: string }[];
  clientOptions: { id: number; name: string }[];
}

interface ClientProps extends BaseProps {
  type: "clients";
  initialFilters: ClientFilters;
  onApply: (f: ClientFilters) => void;
}

interface PersonProps extends BaseProps {
  type: "persons";
  initialFilters: PersonFilters;
  onApply: (f: PersonFilters) => void;
}

interface SquadProps extends BaseProps {
  type: "squads";
  initialFilters: SquadFilters;
  onApply: (f: SquadFilters) => void;
}

type Props = ClientProps | PersonProps | SquadProps;

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  fontSize: 13,
  color: "var(--text)",
  boxSizing: "border-box",
};

function defaultFilters(type: "clients" | "persons" | "squads"): Record<string, string> {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  if (type === "clients") return { from: def, to: def, clientId: "", roleType: "" };
  if (type === "persons") return { from: def, to: def, squadId: "" };
  return { from: def, to: def, squadId: "", roleType: "" };
}

export default function ReportsFilterPanel(props: Props) {
  const { open, onClose, columnDefs, visibleColumns, onToggleColumn } = props;

  // Local state — only committed to parent when Apply is clicked
  const [local, setLocal] = useState<Record<string, string>>(
    props.initialFilters as unknown as Record<string, string>
  );

  // Sync local state when panel opens (picks up any externally applied filters)
  useEffect(() => {
    if (open) {
      setLocal(props.initialFilters as unknown as Record<string, string>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function set(key: string, value: string) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    if (props.type === "clients") {
      props.onApply(local as unknown as ClientFilters);
    } else if (props.type === "persons") {
      props.onApply(local as unknown as PersonFilters);
    } else {
      props.onApply(local as unknown as SquadFilters);
    }
    onClose();
  }

  function handleReset() {
    setLocal(defaultFilters(props.type));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 340,
          maxWidth: "100vw",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>Filters &amp; Columns</span>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--text-muted)",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "20px 24px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            minWidth: 0,
          }}
        >
          {/* Date range */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Date Range</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>From</label>
                <input
                  type="month"
                  style={inputStyle}
                  value={local.from ? local.from.slice(0, 7) : ""}
                  onChange={(e) =>
                    set("from", e.target.value ? `${e.target.value}-01` : "")
                  }
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>To</label>
                <input
                  type="month"
                  style={inputStyle}
                  value={local.to ? local.to.slice(0, 7) : ""}
                  onChange={(e) =>
                    set("to", e.target.value ? `${e.target.value}-01` : "")
                  }
                />
              </div>
            </div>
          </div>

          {/* Entity filters */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Filters</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {props.type === "clients" && (
                <>
                  <div>
                    <label style={labelStyle}>Client</label>
                    <select
                      style={inputStyle}
                      value={local.clientId ?? ""}
                      onChange={(e) => set("clientId", e.target.value)}
                    >
                      <option value="">All clients</option>
                      {props.clientOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Role Type</label>
                    <select
                      style={inputStyle}
                      value={local.roleType ?? ""}
                      onChange={(e) => set("roleType", e.target.value)}
                    >
                      <option value="">All roles</option>
                      {ROLE_TYPES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(props.type === "persons" || props.type === "squads") && (
                <div>
                  <label style={labelStyle}>Squad</label>
                  <select
                    style={inputStyle}
                    value={local.squadId ?? ""}
                    onChange={(e) => set("squadId", e.target.value)}
                  >
                    <option value="">All squads</option>
                    {props.squadOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {props.type === "squads" && (
                <div>
                  <label style={labelStyle}>Role Type</label>
                  <select
                    style={inputStyle}
                    value={local.roleType ?? ""}
                    onChange={(e) => set("roleType", e.target.value)}
                  >
                    <option value="">All roles</option>
                    {ROLE_TYPES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Column visibility */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Columns</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {columnDefs.map((col) => (
                <label
                  key={col.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => onToggleColumn(col.key)}
                    style={{ width: 14, height: 14, flexShrink: 0, cursor: "pointer" }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              fontSize: 13,
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: "7px 20px",
              borderRadius: 6,
              border: "none",
              background: "var(--primary)",
              color: "#FDFDFD",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
