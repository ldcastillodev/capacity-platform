"use client";

import type {
  SimulationMember,
  SimulationMemberRole,
  SimulationResult,
  SimulationVerdict,
} from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard, type StatTone } from "@/components/app/StatCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";

const VERDICT_TONE: Record<SimulationVerdict, "safe" | "watch" | "critical"> = {
  ok: "safe",
  over: "critical",
  ambiguous: "watch",
};

const VERDICT_LABEL: Record<SimulationVerdict, string> = {
  ok: "Capacity available",
  over: "Over capacity",
  ambiguous: "Insufficient data",
};

const ROLE_LABELS: Record<string, string> = {
  dev: "Dev",
  devops: "DevOps",
  qa: "QA",
  design: "Design",
  product: "Product",
  project: "Project",
  tl: "Tech Lead",
  sre: "SRE",
  data: "Data",
  seo: "SEO",
  content: "Content",
};

function fmtHours(n: number): string {
  return `${n.toFixed(1)}h`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  result: SimulationResult;
}

function roleRowBadge(r: SimulationMemberRole) {
  return r.availableHours >= r.requiredHours ? (
    <StatusBadge tone="safe" label="Capacity" />
  ) : (
    <StatusBadge tone="critical" label="No capacity" />
  );
}

function memberHasCapacity(m: SimulationMember): boolean {
  return m.roles.some((r) => r.hasCapacity);
}

// A member has capacity only if every requested role they hold covers its hours.
function memberBadge(m: SimulationMember) {
  return m.roles.every((r) => r.availableHours >= r.requiredHours) ? (
    <StatusBadge tone="safe" label="Has capacity" />
  ) : (
    <StatusBadge tone="critical" label="No capacity" />
  );
}

export function SimulatorResult({ result }: Props) {
  const tone = VERDICT_TONE[result.verdict];
  const gapTone: StatTone | undefined =
    result.gapHours > 0 ? "critical" : result.gapHours < 0 ? "safe" : undefined;
  const verdictClass =
    result.verdict === "ok"
      ? "text-safe border-safe"
      : result.verdict === "over"
        ? "text-critical border-critical"
        : "border-border";

  const squadHasNoCapacity = result.members.length > 0 && !result.members.some(memberHasCapacity);

  const overRoles = result.roleBreakdown.filter((r) => r.verdict === "over");
  const ambiguousRoles = result.roleBreakdown.filter((r) => r.verdict === "ambiguous");
  const roleName = (rt: string) => ROLE_LABELS[rt] ?? rt;

  // Only members who hold at least one of the requested roles are relevant.
  const matchingMembers = result.members.filter((m) => m.roles.length > 0);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          {result.squadName} · {result.month}
        </CardTitle>
        <StatusBadge tone={tone} label={VERDICT_LABEL[result.verdict]} />
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-auto">
        {squadHasNoCapacity && (
          <div
            role="alert"
            className="rounded-md border border-[var(--critical)] bg-[var(--critical-bg)] px-3 py-3 text-sm font-semibold text-[var(--critical)]"
          >
            This squad has no available capacity to absorb the requested hours.
          </div>
        )}
        <p className={cn("text-sm rounded-md border px-3 py-2", verdictClass)}>
          {result.verdict === "ok" ? (
            <>
              <strong>{result.squadName} CAN absorb this engagement.</strong>{" "}
              {fmtHours(result.availableHours)} available vs {fmtHours(result.requiredHours)}{" "}
              required ({fmtHours(-result.gapHours)} to spare).
            </>
          ) : result.verdict === "over" ? (
            <>
              <strong>{result.squadName} CANNOT absorb this engagement.</strong>{" "}
              {overRoles.length > 0 ? (
                <>
                  Insufficient role capacity:{" "}
                  {overRoles
                    .map((r) => `${roleName(r.roleType)} (short ${fmtHours(r.gapHours)})`)
                    .join(", ")}
                  .
                </>
              ) : (
                <>
                  Short by {fmtHours(result.gapHours)} ({fmtHours(result.availableHours)} available
                  vs {fmtHours(result.requiredHours)} required).
                </>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              {ambiguousRoles.length > 0 ? (
                <>
                  Verdict inconclusive — no capacity data for:{" "}
                  {ambiguousRoles.map((r) => roleName(r.roleType)).join(", ")}.
                </>
              ) : (
                <>Verdict inconclusive — no capacity data for this squad/month.</>
              )}
            </span>
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Required" value={fmtHours(result.requiredHours)} />
          <StatCard label="Available" value={fmtHours(result.availableHours)} />
          <StatCard
            label="Gap"
            value={fmtHours(result.gapHours)}
            valueTone={gapTone}
            subtitle={result.gapHours > 0 ? "Short" : result.gapHours < 0 ? "Slack" : "Even"}
          />
        </div>

        {result.roleBreakdown.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Recent avg</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                  <TableHead className="text-right">Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.roleBreakdown.map((r) => {
                  const gapClass =
                    r.gapHours > 0 ? "text-critical" : r.gapHours < 0 ? "text-safe" : undefined;
                  return (
                    <TableRow key={r.roleType}>
                      <TableCell className="font-medium">
                        {ROLE_LABELS[r.roleType] ?? r.roleType}
                      </TableCell>
                      <TableCell className="text-right">{fmtHours(r.requiredHours)}</TableCell>
                      <TableCell className="text-right">{fmtHours(r.capacityHours)}</TableCell>
                      <TableCell className="text-right">{fmtHours(r.recentAvgHours)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmtHours(r.availableHours)}
                      </TableCell>
                      <TableCell className={cn("text-right", gapClass)}>
                        {fmtHours(r.gapHours)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge
                          tone={VERDICT_TONE[r.verdict]}
                          label={VERDICT_LABEL[r.verdict]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {result.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active squad members in this month.</p>
        ) : matchingMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members in this squad hold the requested role(s).
          </p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Members</h3>
            {matchingMembers.map((m) => (
              <div key={m.personId} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.personName}</span>
                    {memberBadge(m)}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {fmtPct(m.allocationPct)} · cap {fmtHours(m.capacityHours)} · 3mo avg{" "}
                    {fmtHours(m.recentAvgHours)} · avail{" "}
                    <span className="font-semibold text-foreground">
                      {fmtHours(m.availableHours)}
                    </span>
                  </span>
                </div>
                <p className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
                  {result.monthlyLabels
                    .map(
                      (label, idx) => `${fmtMonth(label)} ${fmtHours(m.monthlyBillable[idx] ?? 0)}`
                    )
                    .join(" · ")}
                </p>
                <div className="px-3 py-2 space-y-1">
                  {m.roles.map((r) => (
                    <div
                      key={r.roleType}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="font-medium">{ROLE_LABELS[r.roleType] ?? r.roleType}</span>
                      <span className="flex items-center gap-3">
                        <span>
                          avail <span className="font-semibold">{fmtHours(r.availableHours)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          req {fmtHours(r.requiredHours)}
                        </span>
                        {roleRowBadge(r)}
                      </span>
                    </div>
                  ))}
                  {m.unassignedAvgHours > 0 && (
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>Unassigned</span>
                      <span className="flex items-center gap-3">
                        <span>3mo avg {fmtHours(m.unassignedAvgHours)}</span>
                        <span>req —</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
