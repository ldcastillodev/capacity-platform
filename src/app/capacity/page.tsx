"use client";

import type React from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStaffingGaps,
  fetchSquads,
  fetchTeApproved,
  type StaffingGap,
} from "@/lib/client";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

const ROLE_LABELS: Record<string, string> = {
  frontend_dev: "Developer",
  backend_dev: "Developer",
  fullstack_dev: "Developer",
  qa: "QA",
  devops: "DevOps",
  pm: "PM",
  ux: "UX",
  ux_designer: "UX Designer",
  data_engineer: "Data Engineer",
  tech_lead: "Tech Lead",
  sme: "SME",
  product_manager: "Product Manager",
  project_manager: "Project Manager",
  solutions_architect: "Solutions Architect",
  scrum_master: "Scrum Master",
  business_analyst: "Business Analyst",
  seo: "SEO",
  content_author: "Content Author",
  client_services: "Client Services",
};

function fmtHours(h: number): string {
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}

function fmtFree(h: number): string {
  const formatted = fmtHours(Math.abs(h));
  return h >= 0 ? `+${formatted}` : `-${formatted}`;
}

interface StackedBarProps {
  available: number;
  committed: number;
  buffer: number;
  free: number;
}

function StackedBar({ available, committed, buffer, free }: StackedBarProps): React.ReactElement {
  if (available <= 0) {
    return <div style={{ height: 8, width: 140, background: "var(--border)", borderRadius: 99 }} />;
  }
  const committedPct = Math.min((committed / available) * 100, 100);
  const bufferPct = Math.min((buffer / available) * 100, 100 - committedPct);
  const freePct = free > 0 ? Math.min((free / available) * 100, 100 - committedPct - bufferPct) : 0;
  const isOverflow = free < 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ height: 8, width: 140, background: "var(--border)", borderRadius: 99, overflow: "hidden", display: "flex", flexShrink: 0 }}>
        {committedPct > 0 && <div style={{ height: "100%", width: `${committedPct}%`, background: "#3b82f6", flexShrink: 0 }} />}
        {bufferPct > 0 && <div style={{ height: "100%", width: `${bufferPct}%`, background: "#f59e0b", flexShrink: 0 }} />}
        {freePct > 0 && <div style={{ height: "100%", width: `${freePct}%`, background: "var(--safe)", flexShrink: 0 }} />}
      </div>
      {isOverflow && <div style={{ height: 8, width: 8, borderRadius: "50%", background: "var(--critical)", flexShrink: 0 }} />}
    </div>
  );
}

function parseRow(r: StaffingGap) {
  return {
    ...r,
    squad_id: r.squad_id ?? r.squadId,
    role_type: r.role_type ?? r.roleType,
    total_available_hours: parseFloat(String(r.total_available_hours ?? r.totalAvailableHours ?? 0)),
    committed_hours: parseFloat(String(r.committed_hours ?? r.committedHours ?? 0)),
    hard_buffer_hours: parseFloat(String(r.hard_buffer_hours ?? r.hardBufferHours ?? 0)),
    actual_hours: parseFloat(String(r.actual_hours ?? r.actualHours ?? 0)),
    unplanned_hours: parseFloat(String(r.unplanned_hours ?? r.unplannedHours ?? 0)),
    actual_nb_hours: parseFloat(String(r.actual_nb_hours ?? r.actualNbHours ?? 0)),
    net_gap_hours: parseFloat(String(r.net_gap_hours ?? r.netGapHours ?? 0)),
    commitment_ratio: parseFloat(String(r.commitment_ratio ?? r.commitmentRatio ?? 0)),
    is_understaffed: r.is_understaffed ?? r.isUnderstaffed ?? false,
    is_overstaffed: r.is_overstaffed ?? r.isOverstaffed ?? false,
  };
}

type ParsedRow = ReturnType<typeof parseRow>;

const DEV_ROLES = new Set(["frontend_dev", "backend_dev", "fullstack_dev"]);

function mergeDevRows(rows: ParsedRow[]): ParsedRow[] {
  const devRows = rows.filter((r) => DEV_ROLES.has(r.role_type));
  const otherRows = rows.filter((r) => !DEV_ROLES.has(r.role_type));
  if (devRows.length === 0) return otherRows;
  const merged: ParsedRow = {
    ...devRows[0],
    role_type: "frontend_dev",
    total_available_hours: devRows.reduce((s, r) => s + r.total_available_hours, 0),
    committed_hours: devRows.reduce((s, r) => s + r.committed_hours, 0),
    hard_buffer_hours: devRows.reduce((s, r) => s + r.hard_buffer_hours, 0),
    actual_hours: devRows.reduce((s, r) => s + r.actual_hours, 0),
    unplanned_hours: devRows.reduce((s, r) => s + r.unplanned_hours, 0),
    actual_nb_hours: devRows.reduce((s, r) => s + r.actual_nb_hours, 0),
    net_gap_hours: devRows.reduce((s, r) => s + r.net_gap_hours, 0),
    commitment_ratio: 0,
    is_understaffed: false,
    is_overstaffed: false,
  };
  const effNb = Math.max(merged.actual_nb_hours, merged.hard_buffer_hours);
  merged.commitment_ratio =
    merged.total_available_hours > 0
      ? (merged.committed_hours + merged.unplanned_hours + effNb) / merged.total_available_hours
      : 0;
  merged.is_understaffed = devRows.some((r) => r.is_understaffed);
  merged.is_overstaffed = devRows.every((r) => r.is_overstaffed);
  const firstDevOrigIdx = rows.findIndex((r) => DEV_ROLES.has(r.role_type));
  const insertAt = rows.slice(0, firstDevOrigIdx).filter((r) => !DEV_ROLES.has(r.role_type)).length;
  const result = [...otherRows];
  result.splice(insertAt, 0, merged);
  return result;
}

function SquadCard({ squadName, rows, teHours = 0 }: { squadName: string; rows: StaffingGap[]; teHours?: number }): React.ReactElement {
  const parsed = mergeDevRows(rows.map(parseRow));
  const totalAvailable = parsed.reduce((s, r) => s + r.total_available_hours, 0);
  const totalCommitted = parsed.reduce((s, r) => s + r.committed_hours, 0);
  const totalActual = parsed.reduce((s, r) => s + r.actual_hours, 0);
  const totalUnplanned = parsed.reduce((s, r) => s + r.unplanned_hours, 0);
  const totalBuffer = parsed.reduce((s, r) => s + r.hard_buffer_hours, 0);
  const totalActualNb = parsed.reduce((s, r) => s + r.actual_nb_hours, 0);
  const totalFree = parsed.reduce((s, r) => s + r.net_gap_hours, 0);
  const totalCommitRatio = totalAvailable > 0 ? totalCommitted / totalAvailable : 0;
  const anyUnderstaffed = parsed.some((r) => r.is_understaffed);

  let statusLabel: string, statusBg: string, statusColor: string;
  if (anyUnderstaffed) {
    statusLabel = "Understaffed"; statusBg = "rgba(239,68,68,0.12)"; statusColor = "var(--critical)";
  } else if (totalFree > 0 && totalCommitRatio > 0.75) {
    statusLabel = "Near full"; statusBg = "rgba(245,158,11,0.12)"; statusColor = "#f59e0b";
  } else {
    statusLabel = "Has capacity"; statusBg = "rgba(34,197,94,0.12)"; statusColor = "var(--safe)";
  }

  const thStyle: CSSProperties = { padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap" };
  const thLeft: CSSProperties = { ...thStyle, textAlign: "left" };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "14px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{squadName}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: totalFree >= 0 ? "var(--safe)" : "var(--critical)", background: totalFree >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 6, padding: "2px 8px" }}>
          {fmtFree(totalFree)} free
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: statusBg, borderRadius: 6, padding: "2px 8px", marginLeft: "auto" }}>{statusLabel}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thLeft}>Role</th>
            <th style={thStyle}>Capacity</th>
            <th style={thStyle}>Committed</th>
            <th style={thStyle}>Actual</th>
            <th style={thStyle}>Planned NB</th>
            <th style={thStyle}>MgS NB</th>
            <th style={thStyle}>Utilisation</th>
            <th style={thStyle}>Free</th>
            <th style={{ ...thStyle, textAlign: "left", width: 160 }}>Bar</th>
          </tr>
        </thead>
        <tbody>
          {parsed.map((row, idx) => {
            const isEven = idx % 2 === 0;
            const rowBg = isEven ? "var(--surface)" : "var(--bg)";
            const isGapOnly = row.total_available_hours === 0 && row.committed_hours > 0;
            const freeColor = row.net_gap_hours >= 0 ? "var(--safe)" : "var(--critical)";
            const utilisationPct = Math.round(row.commitment_ratio * 100);
            const utilisationColor = utilisationPct > 90 ? "var(--critical)" : utilisationPct > 75 ? "#f59e0b" : "var(--safe)";
            const tdStyle: CSSProperties = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid var(--border)", textAlign: "right", background: isGapOnly ? "rgba(239,68,68,0.04)" : rowBg };
            const tdLeft: CSSProperties = { ...tdStyle, textAlign: "left", borderLeft: row.is_understaffed ? "3px solid var(--critical)" : "3px solid transparent" };
            return (
              <tr key={row.role_type + idx}>
                <td style={tdLeft}>
                  {ROLE_LABELS[row.role_type] ?? row.role_type}
                  {isGapOnly && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "var(--critical)", background: "rgba(239,68,68,0.12)", borderRadius: 4, padding: "1px 6px" }}>no headcount</span>}
                </td>
                <td style={tdStyle}>{isGapOnly ? <span style={{ color: "var(--text-muted)" }}>—</span> : fmtHours(row.total_available_hours)}</td>
                <td style={tdStyle}>{fmtHours(row.committed_hours)}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {fmtHours(row.actual_hours)}
                  {row.unplanned_hours > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", borderRadius: 4, padding: "1px 5px" }}>+{fmtHours(row.unplanned_hours)} unplanned</span>}
                </td>
                <td style={tdStyle}>{isGapOnly ? <span style={{ color: "var(--text-muted)" }}>—</span> : fmtHours(row.hard_buffer_hours)}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {isGapOnly ? <span style={{ color: "var(--text-muted)" }}>—</span> : (
                    <>
                      {fmtHours(row.actual_nb_hours)}
                      {row.actual_nb_hours > row.hard_buffer_hours && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", borderRadius: 4, padding: "1px 5px" }}>+{fmtHours(row.actual_nb_hours - row.hard_buffer_hours)}</span>}
                    </>
                  )}
                </td>
                <td style={tdStyle}>
                  {isGapOnly ? <span style={{ color: "var(--critical)", fontWeight: 600 }}>∞</span> : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <div style={{ height: 5, width: 56, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(utilisationPct, 100)}%`, background: utilisationColor, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 12, color: utilisationColor, fontWeight: 600, minWidth: 32 }}>{utilisationPct}%</span>
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, color: freeColor, fontWeight: 600 }}>{fmtFree(row.net_gap_hours)}</td>
                <td style={{ ...tdStyle, textAlign: "left" }}>
                  {!isGapOnly && <StackedBar available={row.total_available_hours} committed={row.committed_hours} buffer={row.hard_buffer_hours} free={row.net_gap_hours} />}
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          {(() => {
            const t: CSSProperties = { padding: "10px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", background: "var(--bg)", borderTop: "2px solid var(--border)" };
            return (
              <tr>
                <td style={{ ...t, textAlign: "left", borderLeft: "3px solid transparent" }}>Total</td>
                <td style={t}>{fmtHours(totalAvailable)}</td>
                <td style={{ ...t, whiteSpace: "nowrap" }}>
                  {fmtHours(totalCommitted)}
                  {teHours > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.1)", borderRadius: 4, padding: "1px 5px" }}>+{fmtHours(teHours)} T&E</span>}
                </td>
                <td style={{ ...t, whiteSpace: "nowrap" }}>
                  {fmtHours(totalActual)}
                  {totalUnplanned > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", borderRadius: 4, padding: "1px 5px" }}>+{fmtHours(totalUnplanned)}</span>}
                </td>
                <td style={t}>{fmtHours(totalBuffer)}</td>
                <td style={{ ...t, whiteSpace: "nowrap" }}>
                  {fmtHours(totalActualNb)}
                  {totalActualNb > totalBuffer && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", borderRadius: 4, padding: "1px 5px" }}>+{fmtHours(totalActualNb - totalBuffer)}</span>}
                </td>
                <td style={t} />
                <td style={{ ...t, color: totalFree >= 0 ? "var(--safe)" : "var(--critical)" }}>{fmtFree(totalFree)}</td>
                <td style={{ ...t, textAlign: "left" }}><StackedBar available={totalAvailable} committed={totalCommitted} buffer={totalBuffer} free={totalFree} /></td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();

  const { data: gaps, isLoading: gapsLoading } = useQuery({
    queryKey: ["staffing-gaps", month],
    queryFn: () => fetchStaffingGaps({ month }),
  });

  const { data: squads, isLoading: squadsLoading } = useQuery({
    queryKey: ["squads"],
    queryFn: fetchSquads,
  });

  const { data: teApproved = [] } = useQuery({
    queryKey: ["te-approved", month],
    queryFn: () => fetchTeApproved(month),
  });

  const teBySquad: Record<number, number> = {};
  for (const t of teApproved) {
    teBySquad[t.squad_id] = (teBySquad[t.squad_id] ?? 0) + t.te_hours;
  }

  if (gapsLoading || squadsLoading) {
    return <div style={{ color: "var(--text-muted)", padding: "40px 0" }}>Loading…</div>;
  }

  const parsedGaps = (gaps ?? []).map(parseRow);
  const squadNames: Record<number, string> = {};
  for (const s of squads ?? []) { squadNames[s.id] = s.name; }

  const bySquad: Record<number, StaffingGap[]> = {};
  for (const g of parsedGaps) {
    const sid = g.squad_id;
    if (!bySquad[sid]) bySquad[sid] = [];
    bySquad[sid].push(g);
  }

  const sortedSquadIds = Object.keys(bySquad).map(Number).sort((a, b) => (squadNames[a] ?? "").localeCompare(squadNames[b] ?? ""));
  const sumAvailable = parsedGaps.reduce((s, g) => s + g.total_available_hours, 0);
  const sumCommitted = parsedGaps.reduce((s, g) => s + g.committed_hours, 0);
  const sumBuffer = parsedGaps.reduce((s, g) => s + g.hard_buffer_hours, 0);
  const sumFree = parsedGaps.reduce((s, g) => s + g.net_gap_hours, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Monthly Capacity</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{formatMonthDisplay(month)} · Available hours per squad and role</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        {[
          { label: "Total Capacity", value: fmtHours(sumAvailable) },
          { label: "Committed to Clients", value: fmtHours(sumCommitted) },
          { label: "Planned NB", value: fmtHours(sumBuffer) },
          { label: "Free Hours", value: fmtFree(sumFree), color: sumFree >= 0 ? "var(--safe)" : "var(--critical)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", flex: "1 1 0", minWidth: 140 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "var(--text)", lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 32, maxWidth: 560 }}>
        Planned NB is the fixed monthly overhead per person by role (Developer 29h · QA 29h · UX 15h · Content 15h · PM/TL 33h · Scrum Master 100% · SEO 29h), weighted by squad allocation.
      </p>

      {parsedGaps.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No staffing data for this period.</p>
      ) : (
        sortedSquadIds.map((squadId) => (
          <SquadCard key={squadId} squadName={squadNames[squadId] ?? `Squad ${squadId}`} rows={bySquad[squadId] ?? []} teHours={teBySquad[squadId] ?? 0} />
        ))
      )}
    </div>
  );
}
