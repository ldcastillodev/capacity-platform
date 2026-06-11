"use client";

import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import type { ReportKpis as Kpis } from "@/lib/client";

const h = (v: number) => `${v.toFixed(1)}h`;

export function ReportKpis({ kpis }: { kpis: Kpis }) {
  return (
    <MetricCardGrid className="lg:grid-cols-3">
      <StatCard label="Total Hours" value={h(kpis.totalHours)} />
      <StatCard label="Billable" value={h(kpis.billableHours)} />
      <StatCard label="Non-Billable" value={h(kpis.nonBillableHours)} />
    </MetricCardGrid>
  );
}
