"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortState } from "@/hooks/useTableSort";

interface SortableHeadProps<K extends string> {
  colKey: K;
  sort: SortState<K>;
  className?: string;
  /** Set when the column content is right/center aligned so the icon stays beside the label. */
  align?: "left" | "center" | "right";
  children: React.ReactNode;
}

export function SortableHead<K extends string>({
  colKey,
  sort,
  className,
  align = "left",
  children,
}: SortableHeadProps<K>) {
  const active = sort.sortKey === colKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => sort.toggle(colKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          align === "center" && "w-full justify-center"
        )}
      >
        {children}
        {active ? (
          sort.sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
