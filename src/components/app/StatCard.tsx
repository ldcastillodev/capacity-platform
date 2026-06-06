import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  valueColor?: string;
  className?: string;
}

export function StatCard({ label, value, subtitle, valueColor, className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div
          className="text-2xl font-bold leading-tight"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}
