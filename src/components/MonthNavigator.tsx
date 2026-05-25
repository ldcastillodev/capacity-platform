"use client";

import { formatMonthDisplay } from "@/hooks/useMonth";

interface MonthNavigatorProps {
  month: string;
  onChange: (m: string) => void;
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + "T00:00:00");
  d.setMonth(d.getMonth() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export default function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  const btnStyle: React.CSSProperties = {
    padding: "6px 12px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    color: "var(--text)",
  };

  const labelStyle: React.CSSProperties = {
    padding: "6px 16px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    minWidth: 140,
    textAlign: "center",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={btnStyle} onClick={() => onChange(shiftMonth(month, -1))}>
        ←
      </button>
      <span style={labelStyle}>{formatMonthDisplay(month)}</span>
      <button style={btnStyle} onClick={() => onChange(shiftMonth(month, 1))}>
        →
      </button>
    </div>
  );
}

import React from "react";
