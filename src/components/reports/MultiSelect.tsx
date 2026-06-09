"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: number | string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: (number | string)[];
  onChange: (values: (number | string)[]) => void;
  className?: string;
}

export function MultiSelect({ label, options, selected, onChange, className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  function toggle(value: number | string) {
    const key = String(value);
    if (selectedSet.has(key)) {
      onChange(selected.filter((v) => String(v) !== key));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 justify-between font-normal">
            <span className="truncate">
              {selected.length === 0 ? `All ${label.toLowerCase()}` : `${selected.length} selected`}
            </span>
            {selected.length > 0 ? (
              <Badge variant="secondary" className="ml-2 px-1.5">
                {selected.length}
              </Badge>
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2">
            <Input
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto px-1 pb-1">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
            )}
            {filtered.map((o) => {
              const isSelected = selectedSet.has(String(o.value));
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-content-center rounded-sm border border-primary",
                      isSelected ? "bg-primary text-primary-foreground" : "opacity-60"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => onChange([])}
              >
                Clear selection
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
