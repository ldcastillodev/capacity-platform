"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportSeriesPoint } from "@/lib/client";

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

export function ReportChart({ series }: { series: ReportSeriesPoint[] }) {
  const hasPlanned = series.some((p) => p.planned != null);
  const data = series.map((p) => ({
    month: monthLabel(p.month),
    Billable: Number(p.billable.toFixed(2)),
    "Non-Billable": Number(p.nonBillable.toFixed(2)),
    Planned: p.planned == null ? null : Number(p.planned.toFixed(2)),
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
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
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
              {hasPlanned && (
                <Line
                  type="monotone"
                  dataKey="Planned"
                  stroke="var(--watch)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
