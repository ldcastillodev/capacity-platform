"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type BarVariant = "billable" | "nonbillable";

type Tone = "safe" | "watch" | "critical";

// billable: higher is better — red < 25, yellow < 50, green >= 50.
// nonbillable: lower is better — green < 25, yellow 25–50, red > 50.
function barTone(pct: number, variant: BarVariant): Tone {
  if (variant === "billable") {
    if (pct < 25) return "critical";
    if (pct < 50) return "watch";
    return "safe";
  }
  if (pct > 50) return "critical";
  if (pct > 25) return "watch";
  return "safe";
}

const TONE_TEXT: Record<Tone, string> = {
  safe: "text-safe",
  watch: "text-watch",
  critical: "text-critical",
};
const TONE_FILL: Record<Tone, string> = {
  safe: "bg-safe",
  watch: "bg-watch",
  critical: "bg-critical",
};

export function ConsumptionBar({
  pct,
  variant,
  hasCapacity = true,
}: {
  pct: number;
  variant: BarVariant;
  hasCapacity?: boolean;
}): React.ReactElement {
  const width = Math.min(Math.max(pct, 0), 100);
  const tone = barTone(pct, variant);

  return (
    <div className="flex items-center gap-2 max-w-[180px] mx-auto">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-border min-w-[80px]">
        {/* width is data-driven — inline style is the idiomatic exception */}
        <div
          className={cn("h-full rounded-full", TONE_FILL[tone])}
          style={{ width: `${width.toFixed(1)}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums min-w-[46px] text-right",
          hasCapacity ? TONE_TEXT[tone] : "text-muted-foreground"
        )}
      >
        {hasCapacity ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}
