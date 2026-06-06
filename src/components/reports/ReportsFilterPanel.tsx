"use client";

import React, { useEffect, useState } from "react";
import type { ColumnDef } from "./ReportTable";
import type { ClientFilters } from "./ClientsReport";
import type { PersonFilters } from "./PersonsReport";
import type { SquadFilters } from "./SquadsReport";
import { FilterSheet } from "@/components/app/FilterSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const ROLE_TYPES = ["dev","devops","qa","design","product","project","tl","sre","data","seo","content"];

interface BaseProps {
  open: boolean;
  onClose: () => void;
  columnDefs: ColumnDef[];
  visibleColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  squadOptions: { id: number; name: string }[];
  clientOptions: { id: number; name: string }[];
}

interface ClientProps extends BaseProps { type: "clients"; initialFilters: ClientFilters; onApply: (f: ClientFilters) => void; }
interface PersonProps extends BaseProps { type: "persons"; initialFilters: PersonFilters; onApply: (f: PersonFilters) => void; }
interface SquadProps  extends BaseProps { type: "squads";  initialFilters: SquadFilters;  onApply: (f: SquadFilters)  => void; }
type Props = ClientProps | PersonProps | SquadProps;

function defaultFilters(type: "clients" | "persons" | "squads"): Record<string, string> {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  if (type === "clients") return { from: def, to: def, clientId: "", roleType: "" };
  if (type === "persons") return { from: def, to: def, squadId: "" };
  return { from: def, to: def, squadId: "", roleType: "" };
}

function toMonthValue(val: string): string { return val ? val.slice(0, 7) : ""; }
function fromMonthValue(val: string): string { return val ? `${val}-01` : ""; }

export default function ReportsFilterPanel(props: Props) {
  const { open, onClose, columnDefs, visibleColumns, onToggleColumn } = props;
  const [local, setLocal] = useState<Record<string, string>>(props.initialFilters as unknown as Record<string, string>);

  useEffect(() => {
    if (open) setLocal(props.initialFilters as unknown as Record<string, string>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set(key: string, value: string) { setLocal((prev) => ({ ...prev, [key]: value })); }

  function handleApply() {
    if (props.type === "clients") props.onApply(local as unknown as ClientFilters);
    else if (props.type === "persons") props.onApply(local as unknown as PersonFilters);
    else props.onApply(local as unknown as SquadFilters);
    onClose();
  }

  function handleReset() { setLocal(defaultFilters(props.type)); }

  const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <FilterSheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Filters &amp; Columns"
      onApply={handleApply}
      onReset={handleReset}
    >
      <div className="space-y-6">
        {/* Date range */}
        <div>
          <p className="text-sm font-semibold mb-3">Date Range</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="month"
                value={toMonthValue(local.from)}
                onChange={(e) => set("from", fromMonthValue(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="month"
                value={toMonthValue(local.to)}
                onChange={(e) => set("to", fromMonthValue(e.target.value))}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Entity filters */}
        <div>
          <p className="text-sm font-semibold mb-3">Filters</p>
          <div className="space-y-3">
            {props.type === "clients" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <Select value={local.clientId ?? ""} onValueChange={(v) => set("clientId", v === "all" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All clients</SelectItem>
                      {props.clientOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Role Type</Label>
                  <Select value={local.roleType ?? ""} onValueChange={(v) => set("roleType", v === "all" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {ROLE_TYPES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {(props.type === "persons" || props.type === "squads") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Squad</Label>
                <Select value={local.squadId ?? ""} onValueChange={(v) => set("squadId", v === "all" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="All squads" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All squads</SelectItem>
                    {props.squadOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {props.type === "squads" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Role Type</Label>
                <Select value={local.roleType ?? ""} onValueChange={(v) => set("roleType", v === "all" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {ROLE_TYPES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Column visibility */}
        <div>
          <p className="text-sm font-semibold mb-3">Columns</p>
          <div className="space-y-2">
            {columnDefs.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                />
                <Label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">{col.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FilterSheet>
  );
}
