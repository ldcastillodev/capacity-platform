"use client";

import type React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClients,
  fetchConsumption,
  fetchExtensions,
  fetchCeremonyAllocations,
  createExtension,
  approveExtension,
  fetchExtensionDeclarations,
  createExtensionDeclaration,
  type ContractExtension,
  type RoleType,
} from "@/lib/client";
import { CheckCircle, Clock, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

function fmtHours(h: number): string { return h.toFixed(1) + "h"; }

function utilizationColor(pct: number, declared: number): string {
  if (declared === 0) return "var(--text-muted)";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

function utilizationBarColor(pct: number, declared: number): string {
  if (declared === 0) return "var(--border)";
  if (pct > 1.1) return "var(--critical)";
  if (pct < 0.2) return "var(--critical)";
  if (pct >= 0.9) return "var(--watch)";
  if (pct >= 0.4) return "var(--safe)";
  return "var(--watch)";
}

function teApprovedHours(extensions: ContractExtension[]): number {
  return extensions
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + parseFloat(String(e.requested_hours ?? e.requestedHours ?? 0)), 0);
}

const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 14 };
const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, width: "100%" };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", fontWeight: 500, fontSize: 13, cursor: "pointer" };

const ROLE_OPTIONS: RoleType[] = ["frontend_dev","backend_dev","fullstack_dev","qa","devops","ux_designer","data_engineer","tech_lead","product_manager","project_manager","seo","content_author","client_services","scrum_master"];
const ROLE_LABELS: Record<string, string> = { frontend_dev: "Developer (FE)", backend_dev: "Developer (BE)", fullstack_dev: "Developer (FS)", qa: "QA", devops: "DevOps", ux_designer: "UX Designer", data_engineer: "Data Engineer", tech_lead: "Tech Lead", product_manager: "Product Manager", project_manager: "Project Manager", seo: "SEO", content_author: "Content Author", client_services: "Client Services", scrum_master: "Scrum Master" };

function AddExtensionForm({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useMonth();
  const [hours, setHours] = useState("");
  const [role, setRole] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createExtension(clientId, { month, requested_hours: parseFloat(hours), type: "te", status: "approved", role_type: (role as RoleType) || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["extensions"] }); onClose(); },
    onError: () => setError("Failed to save."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) { setError("Enter a valid number of hours (> 0)."); return; }
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "16px 20px", background: "var(--primary-light)", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Month</label>
        <input type="month" value={month.substring(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")} style={inputStyle} required />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Approved Hours *</label>
        <input type="number" min="0.5" step="0.5" placeholder="e.g. 40" value={hours} onChange={(e) => setHours(e.target.value)} style={inputStyle} required />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Role (optional)</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Notes</label>
        <input type="text" placeholder="e.g. Sprint 6 overflow" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={btnPrimary} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
      </div>
      {error && <div style={{ gridColumn: "1 / -1", color: "var(--critical)", fontSize: 13 }}>{error}</div>}
    </form>
  );
}

function TERoleAssignment({ ext, onClose }: { ext: ContractExtension; onClose: () => void }) {
  const qc = useQueryClient();
  const totalHours = parseFloat(String(ext.requested_hours ?? ext.requestedHours ?? 0));
  const { data: existing = [] } = useQuery({ queryKey: ["te-declarations", ext.id], queryFn: () => fetchExtensionDeclarations(ext.id) });
  const existingByRole = Object.fromEntries(existing.map((d) => [d.role_type ?? d.roleType, parseFloat(String(d.declared_hours ?? d.declaredHours ?? 0))]));
  const [hours, setHours] = useState<Record<string, string>>(() => Object.fromEntries(ROLE_OPTIONS.map((r) => [r, String(existingByRole[r] ?? "")])));

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [role, val] of Object.entries(hours)) {
        const h = parseFloat(val);
        if (!isNaN(h) && h > 0) await createExtensionDeclaration(ext.id, { role_type: role, declared_hours: h });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["te-declarations", ext.id] }); qc.invalidateQueries({ queryKey: ["staffing-gaps"] }); onClose(); },
  });

  const allocated = Object.values(hours).map((v) => parseFloat(v) || 0).reduce((a, b) => a + b, 0);
  const remaining = totalHours - allocated;

  return (
    <div style={{ padding: "16px 20px", background: "rgba(99,102,241,0.04)", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Assign roles — {totalHours.toFixed(1)}h T&E</span>
        <span style={{ fontSize: 12, color: remaining < 0 ? "var(--critical)" : "var(--text-muted)" }}>{remaining.toFixed(1)}h remaining</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px 16px", marginBottom: 14 }}>
        {ROLE_OPTIONS.map((role) => (
          <label key={role} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
            {ROLE_LABELS[role] ?? role}
            <input type="number" min="0" step="0.5" value={hours[role]} onChange={(e) => setHours((p) => ({ ...p, [role]: e.target.value }))} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)", width: "100%" }} placeholder="0h" />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || remaining < 0} style={{ ...btnPrimary, padding: "5px 14px", fontSize: 12 }}>{saveMutation.isPending ? "Saving…" : "Save declarations"}</button>
        <button onClick={onClose} style={{ ...btnSecondary, padding: "5px 14px", fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

function ExtensionRow({ ext }: { ext: ContractExtension }) {
  const qc = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const approveMutation = useMutation({ mutationFn: () => approveExtension(ext.id), onSuccess: () => qc.invalidateQueries({ queryKey: ["extensions"] }) });
  const isPending = ext.status === "pending_approval";
  return (
    <>
      <tr>
        <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 13 }}>{(ext.month as string).substring(0, 7)}</td>
        <td style={{ ...tdStyle, fontWeight: 600 }}>+{parseFloat(String(ext.requested_hours ?? ext.requestedHours ?? 0)).toFixed(1)}h</td>
        <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 13 }}>{(ext.role_type ?? ext.roleType) ?? "All roles"}</td>
        <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 13, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ext.notes ?? "—"}</td>
        <td style={tdStyle}>
          {isPending
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--watch)", background: "#fff8e1", padding: "3px 8px", borderRadius: 99 }}><Clock size={11} /> Pending</span>
            : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--safe)", background: "#e6f9f0", padding: "3px 8px", borderRadius: 99 }}><CheckCircle size={11} /> Approved</span>}
        </td>
        <td style={tdStyle}>
          {isPending
            ? <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} style={{ ...btnPrimary, padding: "4px 12px", fontSize: 12, background: "var(--safe)" }}>{approveMutation.isPending ? "…" : "Approve"}</button>
            : <button onClick={() => setShowAssign((v) => !v)} style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12 }}>{showAssign ? "Close" : "Assign roles"}</button>}
        </td>
      </tr>
      {showAssign && !isPending && (
        <tr><td colSpan={6} style={{ padding: 0 }}><TERoleAssignment ext={ext} onClose={() => setShowAssign(false)} /></td></tr>
      )}
    </>
  );
}

function ClientExtensionSection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: extensions = [] } = useQuery({ queryKey: ["extensions", clientId], queryFn: () => fetchExtensions(clientId) });
  const totalApproved = teApprovedHours(extensions);
  const hasPending = extensions.some((e) => e.status === "pending_approval");

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg)", borderBottom: collapsed ? "none" : "1px solid var(--border)", cursor: "pointer" }} onClick={() => setCollapsed((c) => !c)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{clientName}</span>
          {totalApproved > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--safe)", background: "#e6f9f0", padding: "2px 8px", borderRadius: 99 }}>+{totalApproved.toFixed(1)}h approved</span>}
          {hasPending && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--watch)", background: "#fff8e1", padding: "2px 8px", borderRadius: 99 }}>pending approval</span>}
          {extensions.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>no extensions</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowForm((s) => !s); setCollapsed(false); }} style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <PlusCircle size={12} /> Add T&amp;E
          </button>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>
      {!collapsed && (
        <>
          {extensions.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Month","Hours","Role","Notes","Status",""].map((h) => <th key={h} style={{ ...thStyle, background: "var(--surface)" }}>{h}</th>)}
              </tr></thead>
              <tbody>{extensions.map((ext) => <ExtensionRow key={ext.id} ext={ext} />)}</tbody>
            </table>
          )}
          {extensions.length === 0 && !showForm && <p style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No T&amp;E extensions registered.</p>}
          {showForm && <AddExtensionForm clientId={clientId} onClose={() => setShowForm(false)} />}
        </>
      )}
    </div>
  );
}

export default function ConsumptionPage() {
  const [month, setMonth] = useMonth();

  const { data: consumptionRaw, isLoading } = useQuery({ queryKey: ["consumption", month], queryFn: () => fetchConsumption({ month }) });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));
  const clientIds = (clients ?? []).filter((c) => c.is_active ?? c.isActive).map((c) => c.id);

  const { data: allExtensionsMap } = useQuery({
    queryKey: ["extensions", "all", clientIds.join(",")],
    queryFn: async () => {
      if (clientIds.length === 0) return {} as Record<number, ContractExtension[]>;
      const results = await Promise.all(clientIds.map((id) => fetchExtensions(id).then((exts) => ({ id, exts }))));
      return Object.fromEntries(results.map(({ id, exts }) => [id, exts])) as Record<number, ContractExtension[]>;
    },
    enabled: clientIds.length > 0,
  });

  const { data: ceremonyAllocations = [] } = useQuery({ queryKey: ["ceremony-allocation", month], queryFn: () => fetchCeremonyAllocations({ month }) });
  const ceremonyMap = Object.fromEntries(ceremonyAllocations.map((a) => [a.client_id, a.total_allocated_hours]));

  const rolledUp = (consumptionRaw ?? [])
    .filter((r) => (r.role_type ?? r.roleType) === null)
    .map((r) => {
      const declared = parseFloat(String(r.declared_hours ?? r.declaredHours ?? 0));
      const consumed = parseFloat(String(r.consumed_hours ?? r.consumedHours ?? 0));
      return { client_id: r.client_id ?? r.clientId, declared_hours: declared, consumed_hours: consumed, remaining_hours: declared > 0 ? declared - consumed : parseFloat(String(r.remaining_hours ?? r.remainingHours ?? 0)), utilization_pct: declared > 0 ? consumed / declared : 0 };
    });

  const tableRows = rolledUp.map((r) => {
    const exts = allExtensionsMap?.[r.client_id] ?? [];
    const teHours = teApprovedHours(exts);
    const effectiveDeclared = r.declared_hours + teHours;
    const effectiveRemaining = effectiveDeclared > 0 ? effectiveDeclared - r.consumed_hours : r.remaining_hours;
    const effectiveUtil = effectiveDeclared > 0 ? r.consumed_hours / effectiveDeclared : r.utilization_pct;
    return { clientId: r.client_id, clientName: clientMap[r.client_id] ?? `Client ${r.client_id}`, declared: r.declared_hours, teHours, effectiveDeclared, consumed: r.consumed_hours, remaining: effectiveRemaining, utilization: effectiveUtil, rawUtilization: r.utilization_pct };
  }).sort((a, b) => b.utilization - a.utilization);

  const activeClientIds = new Set(rolledUp.map((r) => r.client_id));
  const activeClients = (clients ?? []).filter((c) => (c.is_active ?? c.isActive) && activeClientIds.has(c.id));

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Hours Consumption</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{formatMonthDisplay(month)} · Declared vs Actual</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
            Ceremonies column shows shared ceremony hours allocated proportionally based on logged billable hours.
          </p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
        {tableRows.length === 0
          ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No consumption data for this period.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Retainer</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>+ T&amp;E</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ceremonies</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Consumed</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Remaining</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => {
                  const isDeclaredZero = row.effectiveDeclared === 0;
                  const clampedPct = Math.min(row.utilization, 1);
                  const barFill = utilizationBarColor(row.utilization, row.effectiveDeclared);
                  const textColor = utilizationColor(row.utilization, row.effectiveDeclared);
                  return (
                    <tr
                      key={row.clientId}
                      style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--primary-light)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "var(--surface)" : "var(--bg)"; }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{row.clientName}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-muted)" }}>{row.declared > 0 ? fmtHours(row.declared) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.teHours > 0 ? "var(--safe)" : "var(--text-muted)", fontWeight: row.teHours > 0 ? 600 : 400 }}>{row.teHours > 0 ? "+" + fmtHours(row.teHours) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-muted)", fontSize: 13 }}>{ceremonyMap[row.clientId] ? fmtHours(ceremonyMap[row.clientId]) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtHours(row.consumed)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.remaining < 0 ? "var(--critical)" : "var(--text)" }}>{isDeclaredZero ? "—" : fmtHours(row.remaining)}</td>
                      <td style={tdStyle}>
                        {isDeclaredZero ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden", minWidth: 80 }}>
                              <div style={{ width: `${(clampedPct * 100).toFixed(1)}%`, height: "100%", background: barFill, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: textColor, minWidth: 46, textAlign: "right" }}>{(row.utilization * 100).toFixed(1)}%</span>
                            {row.teHours > 0 && <span style={{ fontSize: 11, color: "var(--safe)", background: "#e6f9f0", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>T&amp;E</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Client-Approved T&amp;E Extensions</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Overages pre-approved by the client. Approved extensions increase the effective hour pool.</p>
      </div>
      <div style={{ background: "#fffbea", border: "1px solid #f5e283", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#7a6100" }}>
        <strong>How it works:</strong> Register client-approved additional hours here. The Remaining column and utilization % will recalculate against the expanded pool.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {activeClients.map((client) => <ClientExtensionSection key={client.id} clientId={client.id} clientName={client.name} />)}
        {activeClients.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No active clients with consumption data.</p>}
      </div>
    </div>
  );
}
