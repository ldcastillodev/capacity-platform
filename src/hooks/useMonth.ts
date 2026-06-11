"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "capacity-platform.month";
const MONTH_RE = /^\d{4}-\d{2}-01$/;

export function useMonth(): [string, (m: string) => void] {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  // Default month on first paint matches the server-rendered HTML; the stored
  // month is restored after mount to avoid a hydration mismatch.
  const [month, setMonthState] = useState(defaultMonth);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored && MONTH_RE.test(stored)) setMonthState(stored);
  }, []);

  const setMonth = useCallback((m: string) => {
    setMonthState(m);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, m);
    } catch {
      // storage unavailable — selection still works for this page
    }
  }, []);

  return [month, setMonth];
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
