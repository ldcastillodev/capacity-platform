"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { fetchContractDailyHours } from "@/lib/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const chartConfig = {
  hours: { label: "Hours", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

interface DailyHoursChartProps {
  contractId: number;
  /** Selected month as `YYYY-MM-01`. */
  month: string;
}

export function DailyHoursChart({ contractId, month }: DailyHoursChartProps) {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const { data, isLoading } = useQuery({
    queryKey: ["contract-daily-hours", contractId, month],
    queryFn: () => fetchContractDailyHours({ contractId, year, month: monthNum }),
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  const byDay = new Map((data ?? []).map((r) => [r.day, r.hours]));
  const chartData = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    hours: byDay.get(i + 1) ?? 0,
  }));

  const maxLogged = chartData.reduce((m, d) => Math.max(m, d.hours), 0);
  const yMax = Math.max(1, maxLogged);

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, yMax]} tickLine={false} axisLine={false} tickMargin={8} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
