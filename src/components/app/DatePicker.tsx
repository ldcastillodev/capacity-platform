"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Local-time parse: new Date("YYYY-MM-DD") is UTC midnight and shifts a day in
// negative-offset timezones.
function parseISODate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

interface Props {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  clearable,
  required,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISODate(value) : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full min-w-0 justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{date ? format(date, "PPP") : placeholder}</span>
          </Button>
        </PopoverTrigger>
        {required && !disabled && (
          // Keeps native form validation: blocks submit while no date picked.
          // Positioned over the trigger so the browser's validation bubble
          // anchors to the visible field instead of off-screen.
          <input
            tabIndex={-1}
            required
            value={value}
            onChange={() => {}}
            onFocus={() => setOpen(true)}
            className="pointer-events-none absolute bottom-0 left-3 h-0 w-0 opacity-0"
            aria-hidden
          />
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          startMonth={new Date(currentYear - 10, 0)}
          endMonth={new Date(currentYear + 5, 11)}
          captionLayout="dropdown"
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            } else if (clearable) {
              onChange("");
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
