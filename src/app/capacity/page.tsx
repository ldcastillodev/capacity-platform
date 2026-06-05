"use client";

import type React from "react";
import MonthNavigator from "@/components/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Monthly Capacity</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{formatMonthDisplay(month)} · Available hours per squad and role</p>
        </div>
        <MonthNavigator month={month} onChange={setMonth} />
      </div>
      <p style={{ color: "var(--text-muted)" }}>Staffing gap data is not available in this version.</p>
    </div>
  );
}
