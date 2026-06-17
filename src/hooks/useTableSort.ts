"use client";

import { useCallback, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  sortKey: K | null;
  sortDir: SortDir;
  toggle: (key: K) => void;
}

/**
 * Sort state with a two-state toggle: clicking the active column flips the
 * direction (asc ↔ desc); clicking a new column selects it ascending.
 */
export function useSortState<K extends string>(initial?: { key: K; dir: SortDir }): SortState<K> {
  const [state, setState] = useState<{ key: K | null; dir: SortDir }>({
    key: initial?.key ?? null,
    dir: initial?.dir ?? "asc",
  });

  const toggle = useCallback((key: K) => {
    setState((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  }, []);

  return { sortKey: state.key, sortDir: state.dir, toggle };
}

/**
 * Returns a new array sorted by the accessor value. Numbers compare
 * numerically, strings via localeCompare; null/undefined sort last in both
 * directions. Never mutates the input.
 */
export function sortRows<T>(
  rows: T[],
  accessor: (row: T) => string | number | null | undefined,
  dir: SortDir
): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1; // nulls last regardless of direction
    if (bNull) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * factor;
    }
    return String(av).localeCompare(String(bv)) * factor;
  });
}
