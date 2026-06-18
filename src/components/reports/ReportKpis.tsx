"use client";

import { StatCard } from "@/components/app/StatCard";
import { MetricCardGrid } from "@/components/app/MetricCardGrid";
import type { ReportKpis as Kpis } from "@/lib/client";
import { formatHours } from "@/lib/utils/formatting";

export function ReportKpis({ kpis }: { kpis: Kpis }) {
  return (
    <MetricCardGrid className="lg:grid-cols-3">
      <StatCard label="Total Hours" value={formatHours(kpis.totalHours)} />
      <StatCard label="Billable" value={formatHours(kpis.billableHours)} />
      <StatCard label="Non-Billable" value={formatHours(kpis.nonBillableHours)} />
    </MetricCardGrid>
  );
}
