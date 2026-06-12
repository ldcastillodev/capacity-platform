"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(value: string): string {
  const [y, m] = value.split("-").map(Number);
  return `${new Date(y, m - 1).toLocaleString("en-US", { month: "long" })} ${y}`;
}

interface Props {
  value: string; // 'YYYY-MM' or ''
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MonthPicker({ value, onChange, placeholder = "Pick a month", className }: Props) {
  const [open, setOpen] = useState(false);
  const selectedYear = value ? Number(value.slice(0, 4)) : new Date().getFullYear();
  const selectedMonth = value ? Number(value.slice(5, 7)) : null;
  const [year, setYear] = useState(selectedYear);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(selectedYear);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatMonth(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(year - 1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-medium select-none">{year}</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(year + 1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => {
            const isSelected = selectedMonth === i + 1 && selectedYear === year;
            return (
              <Button
                key={label}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="h-8 font-normal"
                onClick={() => {
                  onChange(`${year}-${String(i + 1).padStart(2, "0")}`);
                  setOpen(false);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
