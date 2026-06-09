"use client";

import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import type { ReportKpis as Kpis } from "@/lib/client";

const h = (v: number) => `${v.toFixed(1)}h`;

export function ReportKpis({ kpis }: { kpis: Kpis }) {
  const util = kpis.utilizationPct;
  return (
    <MetricCardGrid className="lg:grid-cols-5">
      <StatCard label="Total Hours" value={h(kpis.totalHours)} />
      <StatCard label="Billable" value={h(kpis.billableHours)} />
      <StatCard label="Non-Billable" value={h(kpis.nonBillableHours)} />
      <StatCard
        label="Planned"
        value={kpis.plannedHours == null ? "—" : h(kpis.plannedHours)}
        subtitle={kpis.plannedHours == null ? "n/a for this view" : "confirmed declarations"}
      />
      <StatCard
        label="Utilization"
        value={util == null ? "—" : `${(util * 100).toFixed(1)}%`}
        subtitle="billable / planned"
        valueColor={
          util == null ? undefined : util > 1.0 ? "var(--critical)" : util > 0.9 ? "var(--warning)" : "var(--safe)"
        }
      />
    </MetricCardGrid>
  );
}
