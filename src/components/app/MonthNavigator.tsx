import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMonthDisplay, shiftMonth } from "@/hooks/useMonth";

interface MonthNavigatorProps {
  month: string;
  onChange: (m: string) => void;
  className?: string;
}

export function MonthNavigator({ month, onChange, className }: MonthNavigatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-semibold border border-border rounded-md px-4 py-1.5">
        {formatMonthDisplay(month)}
      </span>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
