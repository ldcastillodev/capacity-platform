"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportGranularity, ReportSeriesPoint } from "@/lib/client";

function periodLabel(iso: string, granularity: ReportGranularity): string {
  const d = new Date(iso);
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ReportChart({
  series,
  granularity,
}: {
  series: ReportSeriesPoint[];
  granularity: ReportGranularity;
}) {
  const data = series.map((p) => ({
    period: periodLabel(p.period, granularity),
    Billable: Number(p.billable.toFixed(2)),
    "Non-Billable": Number(p.nonBillable.toFixed(2)),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Hours over time</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No hours for the selected filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Billable" stackId="actual" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar
                dataKey="Non-Billable"
                stackId="actual"
                fill="hsl(var(--muted-foreground))"
                radius={[2, 2, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
