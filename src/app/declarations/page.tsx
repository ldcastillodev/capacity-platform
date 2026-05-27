"use client";

import type React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import {
  confirmDeclaration,
  fetchClients,
  fetchDeclarations,
  fetchSquads,
  updateDeclaration,
  type Declaration,
  type DeclarationStatus,
} from "@/lib/client";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay, shiftMonth } from "@/hooks/useMonth";

const ROLE_LABELS: Record<string, string> = {
  frontend_dev: "Frontend Dev",
  backend_dev: "Backend Dev",
  fullstack_dev: "Fullstack Dev",
  qa: "QA",
  devops: "DevOps",
  ux_designer: "UX Designer",
  product_manager: "Product Manager",
  project_manager: "Project Manager",
  tech_lead: "Tech Lead",
  solutions_architect: "Solutions Architect",
  data_engineer: "Data Engineer",
  scrum_master: "Scrum Master",
  business_analyst: "Business Analyst",
  seo: "SEO",
  content_author: "Content Author",
};

const STATUS_STYLES: Record<DeclarationStatus, { background: string; color: string; label: string }> = {
  derived:   { background: "#fff8e1", color: "#b45309", label: "⚡ Derived" },
  draft:     { background: "#eff6ff", color: "#1d4ed8", label: "Draft" },
  confirmed: { background: "#f0fdf4", color: "#15803d", label: "✓ Confirmed" },
  locked:    { background: "var(--bg)", color: "var(--text-muted)", label: "🔒 Locked" },
};

function EditableHours({ declaration, onSaved }: { declaration: Declaration; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(declaration.declared_hours);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const hours = parseFloat(inputVal);
    if (isNaN(hours) || hours < 0) { setEditing(false); return; }
    setSaving(true);
    try { await updateDeclaration(declaration.id, hours); onSaved(); }
    finally { setSaving(false); setEditing(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  if (saving) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Saving…</span>;

  if (editing) return (
    <input
      type="number" min="0" step="0.5" value={inputVal}
      onChange={(e) => setInputVal(e.target.value)}
      onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus
      style={{ width: 80, padding: "4px 8px", border: "1px solid var(--primary)", borderRadius: 4, fontSize: 13 }}
    />
  );

  return (
    <span onClick={() => { setInputVal(declaration.declared_hours); setEditing(true); }} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {parseFloat(declaration.declared_hours).toFixed(1)}h
      <Pencil size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </span>
  );
}

function StatusBadge({ status }: { status: DeclarationStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{ background: s.background, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export default function DeclarationsPage() {
  const [month, setMonth] = useMonth();
  const [confirmingSquads, setConfirmingSquads] = useState<Set<number>>(new Set());
  const [confirmingClients, setConfirmingClients] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: declarations, isLoading } = useQuery({
    queryKey: ["declarations", month],
    queryFn: () => fetchDeclarations({ month }),
  });

  const { data: squads } = useQuery({ queryKey: ["squads"], queryFn: fetchSquads });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => confirmDeclaration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["declarations", month] }),
  });

  const handleInvalidate = () => queryClient.invalidateQueries({ queryKey: ["declarations", month] });

  const handleConfirmAll = async (squadId: number, derivedDeclarations: Declaration[]) => {
    setConfirmingSquads((prev) => new Set(prev).add(squadId));
    try { await Promise.all(derivedDeclarations.map((d) => confirmDeclaration(d.id))); queryClient.invalidateQueries({ queryKey: ["declarations", month] }); }
    finally { setConfirmingSquads((prev) => { const n = new Set(prev); n.delete(squadId); return n; }); }
  };

  const handleConfirmClient = async (clientId: number, derivedDeclarations: Declaration[]) => {
    setConfirmingClients((prev) => new Set(prev).add(clientId));
    try { await Promise.all(derivedDeclarations.map((d) => confirmDeclaration(d.id))); queryClient.invalidateQueries({ queryKey: ["declarations", month] }); }
    finally { setConfirmingClients((prev) => { const n = new Set(prev); n.delete(clientId); return n; }); }
  };

  const squadMap = Object.fromEntries((squads ?? []).map((s) => [s.id, s.name]));
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  type ClientGroup = { clientId: number; rows: Declaration[] };
  type SquadGroup = { squadId: number | null; clientGroups: ClientGroup[] };

  const bySquad = new Map<number | null, Map<number, Declaration[]>>();
  for (const decl of declarations ?? []) {
    const squadKey = decl.squad_id;
    if (!bySquad.has(squadKey)) bySquad.set(squadKey, new Map());
    const cMap = bySquad.get(squadKey)!;
    if (!cMap.has(decl.client_id)) cMap.set(decl.client_id, []);
    cMap.get(decl.client_id)!.push(decl);
  }

  const squadGroups: SquadGroup[] = Array.from(bySquad.entries())
    .map(([squadId, cMap]) => ({
      squadId,
      clientGroups: Array.from(cMap.entries())
        .map(([clientId, rows]) => ({ clientId, rows }))
        .sort((a, b) => (clientMap[a.clientId] ?? "").localeCompare(clientMap[b.clientId] ?? "")),
    }))
    .sort((a, b) => {
      const nameA = a.squadId != null ? (squadMap[a.squadId] ?? `Squad ${a.squadId}`) : "—";
      const nameB = b.squadId != null ? (squadMap[b.squadId] ?? `Squad ${b.squadId}`) : "—";
      return nameA.localeCompare(nameB);
    });

  const allDerived = (declarations ?? []).filter((d) => d.status === "derived");
  const prevMonthDisplay = formatMonthDisplay(shiftMonth(month, -1));

  const thStyle: React.CSSProperties = { padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "left", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid var(--border)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Declarations</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{formatMonthDisplay(month)} · Role allocation per squad and client</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading declarations…</p>}

      {!isLoading && allDerived.length > 0 && (
        <div style={{ background: "#fff8e1", border: "1px solid #fbbf24", borderRadius: 10, padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#92400e" }}>
          <strong>{allDerived.length}</strong> declaration{allDerived.length !== 1 ? "s" : ""} auto-derived from <strong>{prevMonthDisplay}</strong>. Review hours and confirm to lock them in.
        </div>
      )}

      {!isLoading && (declarations ?? []).length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No declarations found for this period. Run analytics refresh to generate derived declarations.
        </div>
      )}

      {squadGroups.map(({ squadId, clientGroups }) => {
        const squadName = squadId != null ? (squadMap[squadId] ?? `Squad ${squadId}`) : "Unassigned";
        const allDecls = clientGroups.flatMap((cg) => cg.rows);
        const confirmedCount = allDecls.filter((d) => d.status === "confirmed" || d.status === "locked").length;
        const derivedInSquad = allDecls.filter((d) => d.status === "derived");
        const isConfirmingAll = confirmingSquads.has(squadId ?? -1);

        return (
          <div key={squadId ?? "null"} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{squadName}</span>
                <span style={{ background: "var(--primary-light)", color: "var(--primary)", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>
                  {confirmedCount}/{allDecls.length} confirmed
                </span>
              </div>
              {derivedInSquad.length > 0 && (
                <button
                  onClick={() => handleConfirmAll(squadId ?? -1, derivedInSquad)}
                  disabled={isConfirmingAll}
                  style={{ padding: "6px 14px", background: "var(--safe)", color: "#FDFDFD", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isConfirmingAll ? "not-allowed" : "pointer", opacity: isConfirmingAll ? 0.7 : 1 }}
                >
                  {isConfirmingAll ? "Confirming…" : "Confirm All Derived"}
                </button>
              )}
            </div>

            {clientGroups.map(({ clientId, rows }) => {
              const clientName = clientMap[clientId] ?? `Client ${clientId}`;
              const poolTotal = rows.reduce((sum, d) => sum + parseFloat(d.declared_hours), 0);
              const derivedInClient = rows.filter((d) => d.status === "derived");
              const allConfirmed = rows.every((d) => d.status === "confirmed" || d.status === "locked");
              const isConfirmingClient = confirmingClients.has(clientId);

              return (
                <div key={clientId}>
                  <div style={{ padding: "8px 16px", background: "var(--surface)", fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{clientName}</span>
                      <span>Pool: {poolTotal.toFixed(0)}h</span>
                      {allConfirmed ? (
                        <span style={{ color: "#15803d", background: "#f0fdf4", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>✓ All confirmed</span>
                      ) : derivedInClient.length > 0 ? (
                        <span style={{ color: "#b45309", background: "#fff8e1", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{derivedInClient.length} derived</span>
                      ) : null}
                    </div>
                    {derivedInClient.length > 0 && (
                      <button
                        onClick={() => handleConfirmClient(clientId, derivedInClient)}
                        disabled={isConfirmingClient}
                        style={{ padding: "4px 12px", background: "transparent", color: "var(--safe)", border: "1px solid var(--safe)", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: isConfirmingClient ? "not-allowed" : "pointer", opacity: isConfirmingClient ? 0.7 : 1, whiteSpace: "nowrap" }}
                      >
                        {isConfirmingClient ? "Confirming…" : "Confirm All"}
                      </button>
                    )}
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Role</th>
                        <th style={thStyle}>Hours</th>
                        <th style={thStyle}>Status</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((decl) => {
                        const roleLabel = ROLE_LABELS[decl.role_type] ?? decl.role_type;
                        const isEditable = decl.status !== "locked";
                        return (
                          <tr key={decl.id}>
                            <td style={tdStyle}>{roleLabel}</td>
                            <td style={tdStyle}>
                              {isEditable
                                ? <EditableHours declaration={decl} onSaved={handleInvalidate} />
                                : <span>{parseFloat(decl.declared_hours).toFixed(1)}h</span>}
                            </td>
                            <td style={tdStyle}><StatusBadge status={decl.status} /></td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {(decl.status === "derived" || decl.status === "draft") && (
                                <button
                                  onClick={() => confirmMutation.mutate(decl.id)}
                                  disabled={confirmMutation.isPending}
                                  style={{ padding: "4px 12px", border: "1px solid var(--safe)", background: "transparent", color: "var(--safe)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Confirm
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
