"use client";

import React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissSuggestion,
  fetchNonBillableSummary,
  fetchNonBillableEntries,
  fetchNbBySquad,
  fetchPeople,
  fetchSuggestions,
  type NonBillableSummary,
  type NbEntryGroup,
} from "@/lib/client";
import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      personId, totalHours,
      capacityHours: parseFloat(String(total.capacity_hours ?? total.capacityHours ?? 0)),
      nbPct: parseFloat(String(total.nonbillable_pct ?? total.nonbillablePct ?? 0)),
      momDelta: total.month_over_month_delta != null ? parseFloat(String(total.month_over_month_delta ?? total.monthOverMonthDelta ?? 0)) : null,
      byCategory: cats,
    });
  }
  return results.sort((a, b) => b.nbPct - a.nbPct);
}

function StackedNbBar({ byCategory, capacityHours }: { byCategory: Partial<Record<CatType, number>>; capacityHours: number }): React.ReactElement {
  if (capacityHours <= 0) return <div className="h-2 w-full bg-border rounded-full" />;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden flex min-w-[80px]">
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
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading entries…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No entries found.</p>;
  const byCatType: Partial<Record<CatType, NbEntryGroup[]>> = {};
  for (const g of data) { const ct = g.category_type as CatType; if (!byCatType[ct]) byCatType[ct] = []; byCatType[ct]!.push(g); }

  const allBroad = data.every(
    (g) => g.category_name === "NA Non-Billable" || g.category_name === "MgS Shared Ceremonies" || g.category_name === "Apply General"
  );

  return (
    <div className="flex flex-col gap-1.5">
      {allBroad && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-1">
          ℹ️ This person&apos;s NB time is logged to broad Jira tickets — granular category breakdown not available for NA team.
        </div>
      )}
      {CAT_ORDER.filter((c) => byCatType[c]).map((catType) => {
        const groups = byCatType[catType]!;
        const meta = CAT_META[catType];
        const catTotal = groups.reduce((s, g) => s + g.total_hours, 0);
        return (
          <div key={catType} className="border border-border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              style={{ background: meta.bg }}
              onClick={() => setOpenCat(openCat === catType ? null : catType)}
            >
              <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.icon} {meta.label}</span>
              <span className="text-xs font-semibold ml-auto" style={{ color: meta.color }}>{catTotal.toFixed(1)}h</span>
              <span className="text-xs" style={{ color: meta.color }}>{openCat === catType ? "▾" : "▸"}</span>
            </div>
            {openCat === catType && (
              <div className="bg-card">
                {groups.map((group) => (
                  <div key={group.category_name}>
                    <div className="px-4 py-1 text-xs font-semibold text-muted-foreground bg-muted/30 border-t border-border">
                      {group.category_name} · {group.total_hours.toFixed(1)}h
                    </div>
                    {group.entries.map((e, i) => (
                      <div key={i} className="grid gap-3 px-4 py-1 text-xs border-t border-border items-center" style={{ gridTemplateColumns: "90px 50px 1fr 140px" }}>
                        <span className="text-muted-foreground">{e.date}</span>
                        <span className="font-semibold">{e.hours.toFixed(1)}h</span>
                        <span className="text-muted-foreground truncate">{e.notes ?? "—"}</span>
                        {e.external_ref && <span className="text-right font-mono text-muted-foreground">{e.external_ref}</span>}
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
  const { data: nbBySquad, isLoading: squadLoading } = useQuery({ queryKey: ["nb-by-squad", month], queryFn: () => fetchNbBySquad({ month }) });

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

  return (
    <div>
      <PageHeader
        title="Non-Billable Hours"
        description={`${formatMonthDisplay(month)} · % shown as share of each person's total logged hours`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      <MetricCardGrid className="mb-8">
        <StatCard label="Total NB Hours" value={grandTotalNb.toFixed(1) + "h"} />
        <StatCard label="Avg NB %" value={(avgNbPct * 100).toFixed(1) + "%"}
          valueColor={avgNbPct > 0.30 ? "var(--critical)" : avgNbPct > 0.20 ? "var(--warning)" : avgNbPct >= 0.15 ? "var(--watch)" : undefined} />
        <StatCard label="People Flagged" value={flagged} subtitle="NB% > 25% of logged time"
          valueColor={flagged > 0 ? "var(--critical)" : undefined} />
        <StatCard label="Open Suggestions" value={openSuggestions.length}
          valueColor={openSuggestions.length > 0 ? "var(--warning)" : undefined} />
      </MetricCardGrid>

      <Tabs defaultValue="by_person" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="by_person">By Person</TabsTrigger>
          <TabsTrigger value="by_squad">By Squad</TabsTrigger>
        </TabsList>

        <TabsContent value="by_person">
          {isLoading && <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>}
          {!isLoading && (
            <>
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Where is non-billable time going?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CAT_ORDER.filter((c) => catTotals[c]).map((cat) => {
                    const h = catTotals[cat] ?? 0;
                    const share = grandTotalNb > 0 ? h / grandTotalNb : 0;
                    const meta = CAT_META[cat];
                    return (
                      <div key={cat} className="grid items-center gap-3" style={{ gridTemplateColumns: "180px 1fr 60px 60px" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
                        </div>
                        <div className="h-2.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(share * 100).toFixed(1)}%`, background: meta.color }} />
                        </div>
                        <span className="text-sm font-semibold text-right">{h.toFixed(0)}h</span>
                        <span className="text-xs text-muted-foreground text-right">{(share * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-5 border-b">
                  <CardTitle className="text-base">By Person</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {rollup.length === 0
                    ? <p className="p-6 text-muted-foreground">No data for this period.</p>
                    : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Person</TableHead>
                              <TableHead className="text-right">NB Hours</TableHead>
                              <TableHead className="min-w-[180px]">NB % of logged</TableHead>
                              <TableHead className="text-right">vs last month</TableHead>
                              <TableHead className="text-center">Risk</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rollup.map((row) => {
                              const isExpanded = expandedPerson === row.personId;
                              const color = riskColor(row.nbPct);
                              const hasBreakdown = Object.keys(row.byCategory).length > 0;
                              return (
                                <React.Fragment key={row.personId}>
                                  <TableRow
                                    className={hasBreakdown ? "cursor-pointer" : undefined}
                                    onClick={() => hasBreakdown && setExpandedPerson(isExpanded ? null : row.personId)}
                                  >
                                    <TableCell className="font-medium">
                                      {hasBreakdown && <span className="mr-1.5 text-xs text-muted-foreground">{isExpanded ? "▾" : "▸"}</span>}
                                      {personMap[row.personId] ?? `Person ${row.personId}`}
                                    </TableCell>
                                    <TableCell className="text-right">{row.totalHours.toFixed(1)}h</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-[80px]"><StackedNbBar byCategory={row.byCategory} capacityHours={row.capacityHours} /></div>
                                        <span className="text-xs font-semibold min-w-[42px] text-right" style={{ color }}>{(row.nbPct * 100).toFixed(1)}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm"
                                      style={{ color: row.momDelta == null ? undefined : row.momDelta > 0 ? "var(--critical)" : "var(--safe)" }}>
                                      {row.momDelta == null ? "—" : `${row.momDelta > 0 ? "+" : ""}${row.momDelta.toFixed(1)}h`}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="outline" className="text-xs font-bold" style={{ background: color + "22", color, borderColor: color }}>{riskLabel(row.nbPct)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                      {hasBreakdown && (isExpanded ? "collapse" : "details")}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={6} className="p-0 bg-muted/20">
                                        <div className="py-4 pl-10 pr-4 border-b">
                                          <NbEntryDetail personId={row.personId} month={month} />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="by_squad">
          {squadLoading && <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>}
          {!squadLoading && (
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-5 border-b">
                <CardTitle className="text-base">By Squad</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(nbBySquad ?? []).length === 0
                  ? <p className="p-6 text-muted-foreground">No data for this period. Run analytics refresh to populate.</p>
                  : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Squad</TableHead>
                            <TableHead className="text-right">NB Hours</TableHead>
                            <TableHead className="min-w-[180px]">NB % of capacity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(nbBySquad ?? []).map((row) => {
                            const color = riskColor(row.nb_pct);
                            const clampedPct = Math.min(row.nb_pct, 1);
                            return (
                              <TableRow key={row.squad_id}>
                                <TableCell className="font-medium">{row.squad_name}</TableCell>
                                <TableCell className="text-right">{row.total_hours.toFixed(1)}h</TableCell>
                                <TableCell>
                                  {row.capacity_hours > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden min-w-[80px]">
                                        <div className="h-full rounded-full" style={{ width: `${(clampedPct * 100).toFixed(1)}%`, background: color }} />
                                      </div>
                                      <span className="text-xs font-semibold min-w-[42px] text-right" style={{ color }}>{(row.nb_pct * 100).toFixed(1)}%</span>
                                    </div>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-base">Open Suggestions</h2>
          {openSuggestions.length > 0 && (
            <Badge className="bg-[var(--warning-bg)] text-[var(--warning)] border-0">{openSuggestions.length}</Badge>
          )}
        </div>
        {loadingSuggestions
          ? <p className="text-muted-foreground text-sm">Loading suggestions…</p>
          : openSuggestions.length === 0
            ? <p className="text-muted-foreground text-sm">No open suggestions.</p>
            : (
              <div className="flex flex-col gap-3">
                {openSuggestions.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-5 flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="font-semibold">{personMap[s.person_id ?? s.personId] ?? `Person ${s.person_id ?? s.personId}`}</span>
                          <Badge className="text-xs bg-[var(--warning-bg)] text-[var(--warning)] border-0">
                            {formatSuggestionType(s.suggestion_type ?? s.suggestionType ?? "")}
                          </Badge>
                          {(s.current_hours ?? s.currentHours) && (
                            <span className="text-sm text-muted-foreground">{parseFloat(String(s.current_hours ?? s.currentHours)).toFixed(1)}h logged</span>
                          )}
                        </div>
                        {s.explanation && <p className="text-sm text-muted-foreground leading-relaxed">{s.explanation}</p>}
                        {(s.suggested_action ?? s.suggestedAction) && (
                          <p className="text-sm mt-1.5 leading-relaxed"><strong>Suggested action:</strong> {s.suggested_action ?? s.suggestedAction}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => dismissMutation.mutate(s.id)} disabled={dismissMutation.isPending}>
                        Dismiss
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
