"use client";

import React from "react";

export type BarVariant = "billable" | "nonbillable";

// billable: higher is better — red < 25, yellow < 50, green >= 50.
// nonbillable: lower is better — green < 25, yellow 25–50, red > 50.
function barColor(pct: number, variant: BarVariant): string {
  if (variant === "billable") {
    if (pct < 25) return "var(--critical)";
    if (pct < 50) return "var(--watch)";
    return "var(--safe)";
  }
  if (pct > 50) return "var(--critical)";
  if (pct > 25) return "var(--watch)";
  return "var(--safe)";
}

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

  return (
    <div className="flex items-center gap-2 max-w-[180px] mx-auto">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-border min-w-[80px]">
        <div
          className="h-full rounded-full"
          style={{ width: `${width.toFixed(1)}%`, background: barColor(pct, variant) }}
        />
      </div>
      <span
        className="text-xs font-semibold tabular-nums min-w-[46px] text-right"
        style={{ color: hasCapacity ? barColor(pct, variant) : "var(--text-muted)" }}
      >
        {hasCapacity ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}
