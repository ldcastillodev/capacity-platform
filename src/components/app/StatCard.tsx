import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "safe" | "watch" | "warning" | "critical";

const TONE_CLASS: Record<StatTone, string> = {
  safe: "text-safe",
  watch: "text-watch",
  warning: "text-warning",
  critical: "text-critical",
};

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  valueTone?: StatTone;
  className?: string;
}

export function StatCard({ label, value, subtitle, valueTone, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-1 animate-fade-in transition-transform duration-200 hover:-translate-y-0.5",
        className
      )}
    >
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className={cn("text-2xl font-bold leading-tight", valueTone && TONE_CLASS[valueTone])}>
          {value}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
