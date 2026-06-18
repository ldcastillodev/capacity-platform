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
import { formatHours, formatPercent, parseHours } from "@/lib/utils/formatting";
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
import { cn } from "@/lib/utils";
import type { StatTone } from "@/components/app/StatCard";

type CatType = "leave" | "internal_meeting" | "training" | "shared_ceremony" | "company";

const CAT_META: Record<
  CatType,
  { label: string; tint: string; text: string; bar: string; icon: string }
> = {
  leave: {
    label: "Leave",
    tint: "bg-amber-500/10",
    text: "text-amber-500",
    bar: "bg-amber-500",
    icon: "🏖️",
  },
  internal_meeting: {
    label: "Internal Meetings",
    tint: "bg-blue-500/10",
    text: "text-blue-500",
    bar: "bg-blue-500",
    icon: "💬",
  },
  training: {
    label: "Training",
    tint: "bg-emerald-500/10",
    text: "text-emerald-500",
    bar: "bg-emerald-500",
    icon: "📚",
  },
  shared_ceremony: {
    label: "Ceremonies",
    tint: "bg-indigo-500/10",
    text: "text-indigo-500",
    bar: "bg-indigo-500",
    icon: "🔄",
  },
  company: {
    label: "Company",
    tint: "bg-violet-500/10",
    text: "text-violet-500",
    bar: "bg-violet-500",
    icon: "🏢",
  },
};
const CAT_ORDER: CatType[] = [
  "leave",
  "internal_meeting",
  "training",
  "shared_ceremony",
  "company",
];

type RiskTone = "safe" | "watch" | "warning" | "critical";
function riskTone(nbPct: number): RiskTone {
  if (nbPct > 0.4) return "critical";
  if (nbPct > 0.25) return "warning";
  if (nbPct >= 0.15) return "watch";
  return "safe";
}
const RISK_TEXT: Record<RiskTone, string> = {
  safe: "text-safe",
  watch: "text-watch",
  warning: "text-warning",
  critical: "text-critical",
};
const RISK_FILL: Record<RiskTone, string> = {
  safe: "bg-safe",
  watch: "bg-watch",
  warning: "bg-warning",
  critical: "bg-critical",
};
const RISK_BADGE: Record<RiskTone, string> = {
  safe: "bg-safe-bg text-safe border-safe",
  watch: "bg-watch-bg text-watch border-watch",
  warning: "bg-warning-bg text-warning border-warning",
  critical: "bg-critical-bg text-critical border-critical",
};
function riskLabel(nbPct: number): string {
  if (nbPct > 0.4) return "High risk";
  if (nbPct > 0.25) return "Flagged";
  if (nbPct >= 0.15) return "Watch";
  return "Normal";
}
function formatSuggestionType(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type SuggestionStatus = "open" | "acknowledged" | "applied" | "dismissed";
const STATUS_META: Record<SuggestionStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  acknowledged: { label: "Acknowledged", cls: "bg-[var(--watch-bg)] text-[var(--watch)]" },
  applied: { label: "Applied", cls: "bg-[var(--safe-bg)] text-[var(--safe)]" },
  dismissed: { label: "Dismissed", cls: "bg-muted text-muted-foreground" },
};
const TERMINAL_STATUSES: SuggestionStatus[] = ["applied", "dismissed"];

interface PersonRollup {
  personId: number;
  totalHours: number;
  capacityHours: number;
  nbPct: number;
  momDelta: number | null;
  byCategory: Partial<Record<CatType, number>>;
}

function buildRollup(rows: NonBillableSummary[]): PersonRollup[] {
  const byPerson = new Map<
    number,
    { total: NonBillableSummary | null; cats: Partial<Record<CatType, number>> }
  >();
  for (const row of rows) {
    const pid = row.person_id ?? row.personId;
    if (!byPerson.has(pid)) byPerson.set(pid, { total: null, cats: {} });
    const entry = byPerson.get(pid)!;
    const catType = row.category_type ?? row.categoryType;
    if (catType === null) {
      entry.total = row;
    } else if (Object.keys(CAT_META).includes(catType)) {
      entry.cats[catType as CatType] =
        (entry.cats[catType as CatType] ?? 0) + parseHours(row.total_hours ?? row.totalHours);
    }
  }
  const results: PersonRollup[] = [];
  for (const [personId, { total, cats }] of byPerson.entries()) {
    if (!total) continue;
    const totalHours = parseHours(total.total_hours ?? total.totalHours);
    if (totalHours === 0) continue;
    results.push({
      personId,
      totalHours,
      capacityHours: parseHours(total.capacity_hours ?? total.capacityHours),
      nbPct: parseHours(total.nonbillable_pct ?? total.nonbillablePct),
      momDelta:
        total.month_over_month_delta != null
          ? parseHours(total.month_over_month_delta ?? total.monthOverMonthDelta)
          : null,
      byCategory: cats,
    });
  }
  return results.sort((a, b) => b.nbPct - a.nbPct);
}

function StackedNbBar({
  byCategory,
  capacityHours,
}: {
  byCategory: Partial<Record<CatType, number>>;
  capacityHours: number;
}): React.ReactElement {
  if (capacityHours <= 0) return <div className="h-2 w-full bg-border rounded-full" />;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden flex min-w-[80px]">
        {CAT_ORDER.filter((c) => byCategory[c]).map((cat) => {
          const h = byCategory[cat] ?? 0;
          const w = Math.min((h / capacityHours) * 100, 100);
          // width is data-driven — inline style is the idiomatic exception
          return (
            <div
              key={cat}
              title={`${CAT_META[cat].label}: ${formatHours(h)}`}
              className={cn("h-full shrink-0", CAT_META[cat].bar)}
              style={{ width: `${w.toFixed(2)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function NbEntryDetail({
  personId,
  month,
}: {
  personId: number;
  month: string;
}): React.ReactElement {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["nb-entries", personId, month],
    queryFn: () => fetchNonBillableEntries(personId, month),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading entries…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">No entries found.</p>;
  const byCatType: Partial<Record<CatType, NbEntryGroup[]>> = {};
  for (const g of data) {
    const ct = g.category_type as CatType;
    if (!byCatType[ct]) byCatType[ct] = [];
    byCatType[ct]!.push(g);
  }

  const allBroad = data.every(
    (g) =>
      g.category_name === "NA Non-Billable" ||
      g.category_name === "MgS Shared Ceremonies" ||
      g.category_name === "Apply General"
  );

  return (
    <div className="flex flex-col gap-1.5">
      {allBroad && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-1">
          ℹ️ This person&apos;s NB time is logged to broad Jira tickets — granular category
          breakdown not available for NA team.
        </div>
      )}
      {CAT_ORDER.filter((c) => byCatType[c]).map((catType) => {
        const groups = byCatType[catType]!;
        const meta = CAT_META[catType];
        const catTotal = groups.reduce((s, g) => s + g.total_hours, 0);
        return (
          <div key={catType} className="border border-border rounded-lg overflow-hidden">
            <div
              className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer", meta.tint)}
              onClick={() => setOpenCat(openCat === catType ? null : catType)}
            >
              <span className={cn("text-xs font-bold", meta.text)}>
                {meta.icon} {meta.label}
              </span>
              <span className={cn("text-xs font-semibold ml-auto", meta.text)}>
                {formatHours(catTotal)}
              </span>
              <span className={cn("text-xs", meta.text)}>{openCat === catType ? "▾" : "▸"}</span>
            </div>
            {openCat === catType && (
              <div className="bg-card">
                {groups.map((group) => (
                  <div key={group.category_name}>
                    <div className="px-4 py-1 text-xs font-semibold text-muted-foreground bg-muted/30 border-t border-border">
                      {group.category_name} · {formatHours(group.total_hours)}
                    </div>
                    {group.entries.map((e, i) => (
                      <div
                        key={i}
                        className="grid gap-3 px-4 py-1 text-xs border-t border-border items-center grid-cols-[90px_50px_1fr]"
                      >
                        <span className="text-muted-foreground">{e.date}</span>
                        <span className="font-semibold">{formatHours(e.hours)}</span>
                        <span className="text-right font-mono text-muted-foreground">
                          {e.issue_key ?? "—"}
                        </span>
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

  const { data: summaryRaw, isLoading } = useQuery({
    queryKey: ["nonbillable", month],
    queryFn: () => fetchNonBillableSummary({ month }),
  });
  const { data: people } = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ["suggestions", month, "open"],
    queryFn: () => fetchSuggestions({ month, status: "open" }),
  });
  const { data: nbBySquad, isLoading: squadLoading } = useQuery({
    queryKey: ["nb-by-squad", month],
    queryFn: () => fetchNbBySquad({ month }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => dismissSuggestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
  });

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
  const openSuggestions = suggestions ?? [];

  return (
    <div>
      <PageHeader
        title="Non-Billable Hours"
        description={`${formatMonthDisplay(month)} · % shown as share of each person's total logged hours`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      <MetricCardGrid className="mb-8">
        <StatCard label="Total NB Hours" value={formatHours(grandTotalNb)} />
        <StatCard
          label="Avg NB %"
          value={(avgNbPct * 100).toFixed(1) + "%"}
          valueTone={
            (avgNbPct > 0.3
              ? "critical"
              : avgNbPct > 0.2
                ? "warning"
                : avgNbPct >= 0.15
                  ? "watch"
                  : undefined) as StatTone | undefined
          }
        />
        <StatCard
          label="People Flagged"
          value={flagged}
          subtitle="NB% > 25% of logged time"
          valueTone={flagged > 0 ? "critical" : undefined}
        />
        <StatCard
          label="Open Suggestions"
          value={openSuggestions.length}
          valueTone={openSuggestions.length > 0 ? "warning" : undefined}
        />
      </MetricCardGrid>

      <Tabs defaultValue="by_person" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="by_person">By Person</TabsTrigger>
          <TabsTrigger value="by_squad">By Squad</TabsTrigger>
        </TabsList>

        <TabsContent value="by_person">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
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
                      <div
                        key={cat}
                        className="grid items-center gap-3 grid-cols-[110px_1fr_44px_44px] sm:grid-cols-[180px_1fr_60px_60px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full",
                              meta.tint,
                              meta.text
                            )}
                          >
                            {meta.icon} {meta.label}
                          </span>
                        </div>
                        <div className="h-2.5 bg-border rounded-full overflow-hidden">
                          {/* width is data-driven — inline style is the idiomatic exception */}
                          <div
                            className={cn("h-full rounded-full", meta.bar)}
                            style={{ width: `${(share * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-right">{h.toFixed(0)}h</span>
                        <span className="text-xs text-muted-foreground text-right">
                          {formatPercent(share, { fromFraction: true })}
                        </span>
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
                  {rollup.length === 0 ? (
                    <p className="p-6 text-muted-foreground">No data for this period.</p>
                  ) : (
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
                            const tone = riskTone(row.nbPct);
                            const hasBreakdown = Object.keys(row.byCategory).length > 0;
                            return (
                              <React.Fragment key={row.personId}>
                                <TableRow
                                  className={hasBreakdown ? "cursor-pointer" : undefined}
                                  onClick={() =>
                                    hasBreakdown &&
                                    setExpandedPerson(isExpanded ? null : row.personId)
                                  }
                                >
                                  <TableCell className="font-medium">
                                    {hasBreakdown && (
                                      <span className="mr-1.5 text-xs text-muted-foreground">
                                        {isExpanded ? "▾" : "▸"}
                                      </span>
                                    )}
                                    {personMap[row.personId] ?? `Person ${row.personId}`}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatHours(row.totalHours)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 min-w-[80px]">
                                        <StackedNbBar
                                          byCategory={row.byCategory}
                                          capacityHours={row.capacityHours}
                                        />
                                      </div>
                                      <span
                                        className={cn(
                                          "text-xs font-semibold min-w-[42px] text-right",
                                          RISK_TEXT[tone]
                                        )}
                                      >
                                        {(row.nbPct * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right text-sm",
                                      row.momDelta != null &&
                                        (row.momDelta > 0 ? "text-critical" : "text-safe")
                                    )}
                                  >
                                    {row.momDelta == null
                                      ? "—"
                                      : `${row.momDelta > 0 ? "+" : ""}${formatHours(row.momDelta)}`}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant="outline"
                                      className={cn("text-xs font-bold", RISK_BADGE[tone])}
                                    >
                                      {riskLabel(row.nbPct)}
                                    </Badge>
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
          {squadLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!squadLoading && (
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-5 border-b">
                <CardTitle className="text-base">By Squad</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(nbBySquad ?? []).length === 0 ? (
                  <p className="p-6 text-muted-foreground">
                    No data for this period. Run analytics refresh to populate.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Squad</TableHead>
                          <TableHead className="text-right">NB Hours</TableHead>
                          <TableHead className="text-right">Capacity (h)</TableHead>
                          <TableHead className="min-w-[180px]">NB % of capacity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(nbBySquad ?? []).map((row) => {
                          const tone = riskTone(row.nb_pct);
                          const clampedPct = Math.min(row.nb_pct, 1);
                          return (
                            <TableRow key={row.squad_id}>
                              <TableCell className="font-medium">{row.squad_name}</TableCell>
                              <TableCell className="text-right">
                                {formatHours(row.total_hours)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {row.capacity_hours > 0 ? `${row.capacity_hours.toFixed(0)}h` : "—"}
                              </TableCell>
                              <TableCell>
                                {row.capacity_hours > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden min-w-[80px]">
                                      {/* width is data-driven — inline style is the idiomatic exception */}
                                      <div
                                        className={cn("h-full rounded-full", RISK_FILL[tone])}
                                        style={{ width: `${(clampedPct * 100).toFixed(1)}%` }}
                                      />
                                    </div>
                                    <span
                                      className={cn(
                                        "text-xs font-semibold min-w-[42px] text-right",
                                        RISK_TEXT[tone]
                                      )}
                                    >
                                      {(row.nb_pct * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
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
          <h2 className="font-semibold text-base">Suggestions</h2>
          {openSuggestions.length > 0 && (
            <Badge className="bg-[var(--warning-bg)] text-[var(--warning)] border-0">
              {openSuggestions.length}
            </Badge>
          )}
        </div>
        {loadingSuggestions ? (
          <p className="text-muted-foreground text-sm">Loading suggestions…</p>
        ) : openSuggestions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No suggestions for this period.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {openSuggestions.map((s) => {
              const pid = s.person_id ?? s.personId;
              const subjectName =
                pid != null
                  ? (personMap[pid] ?? `Person ${pid}`)
                  : (s.squad?.name ?? `Squad ${s.squad_id ?? s.squadId ?? "—"}`);
              const status = (s.status ?? "open") as SuggestionStatus;
              const statusMeta = STATUS_META[status] ?? STATUS_META.open;
              const isTerminal = TERMINAL_STATUSES.includes(status);
              const currentHours = s.current_hours ?? s.currentHours;
              const suggestedHours = s.suggested_hours ?? s.suggestedHours;
              return (
                <Card
                  key={s.id}
                  className="animate-fade-in transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <CardContent className="p-5 flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <span className="font-semibold">{subjectName}</span>
                        <Badge className="text-xs bg-[var(--warning-bg)] text-[var(--warning)] border-0">
                          {formatSuggestionType(s.suggestion_type ?? s.suggestionType ?? "")}
                        </Badge>
                        <Badge className={cn("text-xs border-0", statusMeta.cls)}>
                          {statusMeta.label}
                        </Badge>
                        {currentHours != null && (
                          <span className="text-sm text-muted-foreground">
                            {formatHours(parseFloat(String(currentHours)))} logged
                          </span>
                        )}
                        {suggestedHours != null && (
                          <span className="text-sm text-muted-foreground">
                            target {formatHours(parseFloat(String(suggestedHours)))}
                          </span>
                        )}
                      </div>
                      {s.explanation && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {s.explanation}
                        </p>
                      )}
                      {(s.suggested_action ?? s.suggestedAction) && (
                        <p className="text-sm mt-1.5 leading-relaxed">
                          <strong>Suggested action:</strong>{" "}
                          {s.suggested_action ?? s.suggestedAction}
                        </p>
                      )}
                    </div>
                    {!isTerminal && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismissMutation.mutate(s.id)}
                        disabled={dismissMutation.isPending}
                      >
                        Dismiss
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
