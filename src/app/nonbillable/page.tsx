"use client";

import React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissSuggestion,
  fetchNonBillableSummary,
  fetchNonBillableEntries,
  fetchPeople,
  fetchSuggestions,
  type NonBillableSummary,
  type NbEntryGroup,
} from "@/lib/client";
import { StatCard } from "@/components/StatCard";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

type CatType = "leave" | "internal_meeting" | "training" | "shared_ceremony" | "company";

const CAT_META: Record<CatType, { label: string; color: string; bg: string; icon: string }> = {
  leave:            { label: "Leave",             color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "🏖️" },
  internal_meeting: { label: "Internal Meetings", color: "#3b82f6", bg: "rgba(59,130,246,0.10)", icon: "💬" },
  training:         { label: "Training",          color: "#10b981", bg: "rgba(16,185,129,0.10)", icon: "📚" },
  shared_ceremony:  { label: "Ceremonies",        color: "#6366f1", bg: "rgba(99,102,241,0.10)", icon: "🔄" },
  company:          { label: "Company",           color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: "🏢" },
};
const CAT_ORDER: CatType[] = ["leave","internal_meeting","training","shared_ceremony","company"];

function riskColor(nbPct: number): string {
  if (nbPct > 0.40) return "var(--critical)";
  if (nbPct > 0.25) return "var(--warning)";
  if (nbPct >= 0.15) return "var(--watch)";
  return "var(--safe)";
}
function riskLabel(nbPct: number): string {
  if (nbPct > 0.40) return "High risk";
  if (nbPct > 0.25) return "Flagged";
  if (nbPct >= 0.15) return "Watch";
  return "Normal";
}
function formatSuggestionType(raw: string): string {
  return raw.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface PersonRollup {
  personId: number;
  totalHours: number;
  capacityHours: number;
  nbPct: number;
  momDelta: number | null;
  byCategory: Partial<Record<CatType, number>>;
}

function buildRollup(rows: NonBillableSummary[]): PersonRollup[] {
  const byPerson = new Map<number, { total: NonBillableSummary | null; cats: Partial<Record<CatType, number>> }>();
  for (const row of rows) {
    const pid = row.person_id ?? row.personId;
    if (!byPerson.has(pid)) byPerson.set(pid, { total: null, cats: {} });
    const entry = byPerson.get(pid)!;
    const catType = row.category_type ?? row.categoryType;
    if (catType === null) { entry.total = row; }
    else if (Object.keys(CAT_META).includes(catType)) {
      entry.cats[catType as CatType] = (entry.cats[catType as CatType] ?? 0) + parseFloat(String(row.total_hours ?? row.totalHours ?? 0));
    }
  }
  const results: PersonRollup[] = [];
  for (const [personId, { total, cats }] of byPerson.entries()) {
    if (!total) continue;
    const totalHours = parseFloat(String(total.total_hours ?? total.totalHours ?? 0));
    if (totalHours === 0) continue;
    results.push({
      personId,
      totalHours,
      capacityHours: parseFloat(String(total.capacity_hours ?? total.capacityHours ?? 0)),
      nbPct: parseFloat(String(total.nonbillable_pct ?? total.nonbillablePct ?? 0)),
      momDelta: total.month_over_month_delta != null ? parseFloat(String(total.month_over_month_delta ?? total.monthOverMonthDelta ?? 0)) : null,
      byCategory: cats,
    });
  }
  return results.sort((a, b) => b.nbPct - a.nbPct);
}

function StackedNbBar({ byCategory, capacityHours }: { byCategory: Partial<Record<CatType, number>>; capacityHours: number }): React.ReactElement {
  if (capacityHours <= 0) return <div style={{ height: 8, width: "100%", background: "var(--border)", borderRadius: 99 }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden", display: "flex", minWidth: 80 }}>
        {CAT_ORDER.filter((c) => byCategory[c]).map((cat) => {
          const h = byCategory[cat] ?? 0;
          const w = Math.min((h / capacityHours) * 100, 100);
          return <div key={cat} title={`${CAT_META[cat].label}: ${h.toFixed(1)}h`} style={{ width: `${w.toFixed(2)}%`, height: "100%", background: CAT_META[cat].color, flexShrink: 0 }} />;
        })}
      </div>
    </div>
  );
}

function NbEntryDetail({ personId, month }: { personId: number; month: string }): React.ReactElement {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["nb-entries", personId, month], queryFn: () => fetchNonBillableEntries(personId, month) });
  if (isLoading) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading entries…</p>;
  if (!data || data.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No entries found.</p>;
  const byCatType: Partial<Record<CatType, NbEntryGroup[]>> = {};
  for (const g of data) { const ct = g.category_type as CatType; if (!byCatType[ct]) byCatType[ct] = []; byCatType[ct]!.push(g); }

  const allBroad = data.every(
    (g) => g.category_name === "NA Non-Billable" || g.category_name === "MgS Shared Ceremonies" || g.category_name === "Apply General"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {allBroad && (
        <div style={{
          fontSize: 12, color: "#92400e", background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "6px 10px", marginBottom: 4,
        }}>
          ℹ️ This person&apos;s NB time is logged to broad Jira tickets — granular category breakdown not available for NA team.
        </div>
      )}
      {CAT_ORDER.filter((c) => byCatType[c]).map((catType) => {
        const groups = byCatType[catType]!;
        const meta = CAT_META[catType];
        const catTotal = groups.reduce((s, g) => s + g.total_hours, 0);
        return (
          <div key={catType} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: meta.bg, cursor: "pointer" }} onClick={() => setOpenCat(openCat === catType ? null : catType)}>
              <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.icon} {meta.label}</span>
              <span style={{ fontSize: 12, color: meta.color, fontWeight: 600, marginLeft: "auto" }}>{catTotal.toFixed(1)}h</span>
              <span style={{ fontSize: 11, color: meta.color }}>{openCat === catType ? "▾" : "▸"}</span>
            </div>
            {openCat === catType && (
              <div style={{ background: "var(--surface)" }}>
                {groups.map((group) => (
                  <div key={group.category_name}>
                    <div style={{ padding: "5px 12px 2px 24px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>{group.category_name} · {group.total_hours.toFixed(1)}h</div>
                    {group.entries.map((e, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 50px 1fr 140px", gap: 12, padding: "5px 12px 5px 24px", fontSize: 12, borderTop: "1px solid var(--border)", alignItems: "center", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{e.date}</span>
                        <span style={{ fontWeight: 600 }}>{e.hours.toFixed(1)}h</span>
                        <span style={{ color: "var(--text-muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes ?? "—"}</span>
                        {e.external_ref && <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace" }}>{e.external_ref}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NonBillablePage() {
  const [month, setMonth] = useMonth();
  const queryClient = useQueryClient();
  const [expandedPerson, setExpandedPerson] = useState<number | null>(null);

  const { data: summaryRaw, isLoading } = useQuery({ queryKey: ["nonbillable", month], queryFn: () => fetchNonBillableSummary({ month }) });
  const { data: people } = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({ queryKey: ["suggestions", month, "open"], queryFn: () => fetchSuggestions({ month, status: "open" }) });

  const dismissMutation = useMutation({ mutationFn: (id: number) => dismissSuggestion(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggestions"] }) });

  const personMap = Object.fromEntries((people ?? []).map((p) => [p.id, p.name]));
  const rollup = buildRollup(summaryRaw ?? []);

  const catTotals: Partial<Record<CatType, number>> = {};
  let grandTotalNb = 0;
  for (const p of rollup) {
    grandTotalNb += p.totalHours;
    for (const [cat, h] of Object.entries(p.byCategory) as [CatType, number][]) {
      catTotals[cat] = (catTotals[cat] ?? 0) + h;
    }
  }

  const flagged = rollup.filter((r) => r.nbPct > 0.25).length;
  const avgNbPct = rollup.length > 0 ? rollup.reduce((s, r) => s + r.nbPct, 0) / rollup.length : 0;
  const openSuggestions = (suggestions ?? []).filter((s) => s.status === "open");

  const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)", whiteSpace: "nowrap" };

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Non-Billable Hours</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{formatMonthDisplay(month)} · % shown as share of each person's total logged hours</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total NB Hours" value={grandTotalNb.toFixed(1) + "h"} />
        <StatCard
          label="Avg NB %"
          value={(avgNbPct * 100).toFixed(1) + "%"}
          color={avgNbPct > 0.30 ? "var(--critical)" : avgNbPct > 0.20 ? "var(--warning)" : avgNbPct >= 0.15 ? "var(--watch)" : undefined}
        />
        <StatCard
          label="People Flagged"
          value={flagged}
          sub="NB% > 25% of logged time"
          color={flagged > 0 ? "var(--critical)" : undefined}
        />
        <StatCard
          label="Open Suggestions"
          value={openSuggestions.length}
          color={openSuggestions.length > 0 ? "var(--warning)" : undefined}
        />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Where is non-billable time going?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CAT_ORDER.filter((c) => catTotals[c]).map((cat) => {
            const h = catTotals[cat] ?? 0;
            const share = grandTotalNb > 0 ? h / grandTotalNb : 0;
            const meta = CAT_META[cat];
            return (
              <div key={cat} style={{ display: "grid", gridTemplateColumns: "180px 1fr 60px 60px", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
                </div>
                <div style={{ height: 10, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${(share * 100).toFixed(1)}%`, height: "100%", background: meta.color, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{h.toFixed(0)}h</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{(share * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 15 }}>By Person</div>
        {rollup.length === 0
          ? <p style={{ padding: 24, color: "var(--text-muted)" }}>No data for this period.</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Person</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>NB Hours</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>NB % of logged</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>vs last month</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Risk</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((row, i) => {
                  const isExpanded = expandedPerson === row.personId;
                  const color = riskColor(row.nbPct);
                  const hasBreakdown = Object.keys(row.byCategory).length > 0;
                  return (
                    <React.Fragment key={row.personId}>
                      <tr
                        style={{ background: isExpanded ? "var(--primary-light)" : i % 2 === 0 ? "var(--surface)" : "var(--bg)", cursor: hasBreakdown ? "pointer" : "default" }}
                        onClick={() => hasBreakdown && setExpandedPerson(isExpanded ? null : row.personId)}
                      >
                        <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 500 }}>
                          {hasBreakdown && <span style={{ marginRight: 6, color: "var(--text-muted)", fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>}
                          {personMap[row.personId] ?? `Person ${row.personId}`}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 14, textAlign: "right" }}>{row.totalHours.toFixed(1)}h</td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 80 }}><StackedNbBar byCategory={row.byCategory} capacityHours={row.capacityHours} /></div>
                            <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 42, textAlign: "right" }}>{(row.nbPct * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right", color: row.momDelta == null ? "var(--text-muted)" : row.momDelta > 0 ? "var(--critical)" : "var(--safe)" }}>
                          {row.momDelta == null ? "—" : `${row.momDelta > 0 ? "+" : ""}${row.momDelta.toFixed(1)}h`}
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: color + "22", color }}>{riskLabel(row.nbPct)}</span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "right" }}>
                          {hasBreakdown && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "collapse" : "details"}</span>}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${row.personId}-expand`}>
                          <td colSpan={6} style={{ padding: 0, background: "var(--bg)" }}>
                            <div style={{ padding: "16px 24px 16px 44px", borderBottom: "1px solid var(--border)" }}>
                              <NbEntryDetail personId={row.personId} month={month} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
          Open Suggestions
          {openSuggestions.length > 0 && <span style={{ marginLeft: 8, background: "rgba(249,115,22,0.12)", color: "var(--warning)", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{openSuggestions.length}</span>}
        </div>
        {loadingSuggestions ? <p style={{ color: "var(--text-muted)" }}>Loading suggestions…</p>
          : openSuggestions.length === 0 ? <p style={{ color: "var(--text-muted)" }}>No open suggestions.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {openSuggestions.map((s) => (
                <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{personMap[s.person_id ?? s.personId] ?? `Person ${s.person_id ?? s.personId}`}</span>
                        <span style={{ background: "rgba(249,115,22,0.12)", color: "var(--warning)", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{formatSuggestionType(s.suggestion_type ?? s.suggestionType ?? "")}</span>
                        {(s.current_hours ?? s.currentHours) && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{parseFloat(String(s.current_hours ?? s.currentHours)).toFixed(1)}h logged</span>}
                      </div>
                      {s.explanation && <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>{s.explanation}</p>}
                      {(s.suggested_action ?? s.suggestedAction) && <p style={{ color: "var(--text)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}><strong>Suggested action:</strong> {s.suggested_action ?? s.suggestedAction}</p>}
                    </div>
                    <button onClick={() => dismissMutation.mutate(s.id)} disabled={dismissMutation.isPending} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
