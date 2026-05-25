"use client";

import { useState } from "react";

export function useMonth(): [string, (m: string) => void] {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return useState(defaultMonth);
}

export function formatMonthDisplay(month: string): string {
  const d = new Date(month + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + "T00:00:00");
  d.setMonth(d.getMonth() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
