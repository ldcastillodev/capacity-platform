"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "./MultiSelect";
import {
  ROLE_TYPES,
  roleLabel,
  DIMENSION_LABELS,
  GRANULARITY_LABELS,
  BILLABILITY_LABELS,
  type Billability,
} from "./roleLabels";
import type { ReportDimension, ReportGranularity, ReportFilterOptions } from "@/lib/client";

export interface ReportFilterState {
  from: string;
  to: string;
  dimensions: ReportDimension[];
  granularity: ReportGranularity;
  billability: Billability;
  personIds: number[];
  squadIds: number[];
  clientIds: number[];
  contractIds: number[];
  sowIds: number[];
  roleTypes: string[];
}

interface Props {
  filters: ReportFilterState;
  onChange: (patch: Partial<ReportFilterState>) => void;
  onReset: () => void;
  options?: ReportFilterOptions;
}

// 'YYYY-MM-01' → 'YYYY-MM' for <input type=month>
const toMonthInput = (iso: string) => iso.slice(0, 7);
const fromMonthInput = (v: string) => (v ? `${v}-01` : "");

export function ReportFilters({ filters, onChange, onReset, options }: Props) {
  // Cascading option lists: parent selections narrow downstream choices.
  const personOpts = useMemo(() => {
    const persons = options?.persons ?? [];
    const squadSel = new Set(filters.squadIds);
    const narrowed = filters.squadIds.length
      ? persons.filter((p) => p.squadIds.some((id) => squadSel.has(id)))
      : persons;
    return narrowed.map((p) => ({ value: p.id, label: p.name }));
  }, [options, filters.squadIds]);

  const sowOpts = useMemo(() => {
    const sows = options?.sows ?? [];
    const clientSel = new Set(filters.clientIds);
    const narrowed = filters.clientIds.length ? sows.filter((s) => clientSel.has(s.clientId)) : sows;
    return narrowed.map((s) => ({ value: s.id, label: s.name }));
  }, [options, filters.clientIds]);

  const contractOpts = useMemo(() => {
    const contracts = options?.contracts ?? [];
    const sowClientById = new Map((options?.sows ?? []).map((s) => [s.id, s.clientId]));
    const clientSel = new Set(filters.clientIds);
    const sowSel = new Set(filters.sowIds);
    const narrowed = contracts.filter((c) => {
      if (filters.sowIds.length && !sowSel.has(c.sowId)) return false;
      if (filters.clientIds.length) {
        const clientId = sowClientById.get(c.sowId);
        if (clientId == null || !clientSel.has(clientId)) return false;
      }
      return true;
    });
    return narrowed.map((c) => ({ value: c.id, label: c.name }));
  }, [options, filters.clientIds, filters.sowIds]);

  const squadOpts = (options?.squads ?? []).map((s) => ({ value: s.id, label: s.name }));
  const clientOpts = (options?.clients ?? []).map((c) => ({ value: c.id, label: c.name }));
  const roleOpts = ROLE_TYPES.map((r) => ({ value: r, label: roleLabel(r) }));
  const dimensionOpts = (Object.keys(DIMENSION_LABELS) as ReportDimension[]).map((d) => ({
    value: d,
    label: DIMENSION_LABELS[d],
  }));

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="month"
              value={toMonthInput(filters.from)}
              onChange={(e) => onChange({ from: fromMonthInput(e.target.value) })}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="month"
              value={toMonthInput(filters.to)}
              onChange={(e) => onChange({ to: fromMonthInput(e.target.value) })}
              className="h-9"
            />
          </div>
          <MultiSelect
            label="Row dimensions"
            options={dimensionOpts}
            selected={filters.dimensions}
            onChange={(v) => onChange({ dimensions: v.map(String) as ReportDimension[] })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Granularity</label>
            <Select
              value={filters.granularity}
              onValueChange={(v) => onChange({ granularity: v as ReportGranularity })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GRANULARITY_LABELS) as ReportGranularity[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {GRANULARITY_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Billability</label>
            <Select
              value={filters.billability}
              onValueChange={(v) => onChange({ billability: v as Billability })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BILLABILITY_LABELS) as Billability[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BILLABILITY_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MultiSelect
            label="Squad"
            options={squadOpts}
            selected={filters.squadIds}
            onChange={(v) => onChange({ squadIds: v.map(Number) })}
          />
          <MultiSelect
            label="Person"
            options={personOpts}
            selected={filters.personIds}
            onChange={(v) => onChange({ personIds: v.map(Number) })}
          />
          <MultiSelect
            label="Client"
            options={clientOpts}
            selected={filters.clientIds}
            onChange={(v) => onChange({ clientIds: v.map(Number) })}
          />
          <MultiSelect
            label="SOW"
            options={sowOpts}
            selected={filters.sowIds}
            onChange={(v) => onChange({ sowIds: v.map(Number) })}
          />
          <MultiSelect
            label="Contract"
            options={contractOpts}
            selected={filters.contractIds}
            onChange={(v) => onChange({ contractIds: v.map(Number) })}
          />
          <MultiSelect
            label="Role"
            options={roleOpts}
            selected={filters.roleTypes}
            onChange={(v) => onChange({ roleTypes: v.map(String) })}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
