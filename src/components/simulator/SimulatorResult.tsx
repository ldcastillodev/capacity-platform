"use client";

import type {
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
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge } from "@/components/app/StatusBadge";

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

export function SimulatorResult({ result }: Props) {
  const tone = VERDICT_TONE[result.verdict];
  const gapColor =
    result.gapHours > 0 ? "var(--critical)" : result.gapHours < 0 ? "var(--safe)" : undefined;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          {result.squadName} · {result.month}
        </CardTitle>
        <StatusBadge tone={tone} label={VERDICT_LABEL[result.verdict]} />
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-auto">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Required" value={fmtHours(result.requiredHours)} />
          <StatCard label="Available" value={fmtHours(result.availableHours)} />
          <StatCard
            label="Gap"
            value={fmtHours(result.gapHours)}
            valueColor={gapColor}
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
                  const gapColor =
                    r.gapHours > 0
                      ? "var(--critical)"
                      : r.gapHours < 0
                        ? "var(--safe)"
                        : undefined;
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
                      <TableCell className="text-right" style={{ color: gapColor }}>
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
          <p className="text-sm text-muted-foreground">
            No active squad members in this month.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Alloc</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  {result.monthlyLabels.map((label) => (
                    <TableHead key={label} className="text-right">
                      {fmtMonth(label)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Billable 3mo avg</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.members.map((m) => (
                  <TableRow key={m.personId}>
                    <TableCell className="font-medium">{m.personName}</TableCell>
                    <TableCell className="text-right">{fmtPct(m.allocationPct)}</TableCell>
                    <TableCell className="text-right">{fmtHours(m.capacityHours)}</TableCell>
                    {result.monthlyLabels.map((label, idx) => (
                      <TableCell key={label} className="text-right">
                        {fmtHours(m.monthlyBillable[idx] ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">{fmtHours(m.recentAvgHours)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmtHours(m.availableHours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
