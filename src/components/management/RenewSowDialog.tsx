"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/app/DatePicker";
import { Skeleton } from "@/components/ui/skeleton";

function fmtDate(iso: string) {
  return iso.split("T")[0];
}
function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

interface SowRecord {
  id: number;
  name: string;
  clientId: number;
  startDate: string;
  endDate: string | null;
  client: { id: number; name: string };
}

interface ContractRecord {
  id: number;
  name: string;
  sowId: number;
  hourType: "monthly" | "total";
  assignedHours: string;
  status: "active" | "paused" | "closed";
}

interface ComponentRecord {
  id: number;
  componentKey: string;
  contractId: number;
  effectiveTo: string | null;
}

interface ContractDraft {
  selected: boolean;
  assignedHours: string;
}

interface RenewSowDialogProps {
  sow: SowRecord | null;
  onClose: () => void;
}

export function RenewSowDialog({ sow, onClose }: RenewSowDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [drafts, setDrafts] = useState<Record<number, ContractDraft>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeSowId, setActiveSowId] = useState<number | null>(null);

  const {
    data: contracts = [],
    isLoading: contractsLoading,
    isError: contractsError,
  } = useQuery({
    queryKey: ["mgmt-contracts"],
    queryFn: () => api.get<ContractRecord[]>("/management/contracts").then((r) => r.data),
    enabled: !!sow,
  });
  const { data: components = [] } = useQuery({
    queryKey: ["mgmt-components", false],
    queryFn: () =>
      api
        .get<ComponentRecord[]>("/management/components?includeArchived=false")
        .then((r) => r.data),
    enabled: !!sow,
  });

  const sowContracts = useMemo(
    () => contracts.filter((c) => c.sowId === sow?.id),
    [contracts, sow?.id]
  );

  // Prefill details when the opened SOW changes (render-phase reset, per React's
  // "adjust state during render" pattern — avoids setState-in-effect).
  if ((sow?.id ?? null) !== activeSowId) {
    setActiveSowId(sow?.id ?? null);
    setName(sow?.name ?? "");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setDrafts({});
    setApiError(null);
  }

  // Default all contracts selected with their current hours, once they load.
  if (sow && Object.keys(drafts).length === 0 && sowContracts.length > 0) {
    setDrafts(
      Object.fromEntries(
        sowContracts.map((c) => [c.id, { selected: true, assignedHours: c.assignedHours }])
      )
    );
  }

  const renewMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/management/statement-of-works/${sow!.id}/renew`, {
          name,
          start_date: startDate,
          end_date: endDate || undefined,
          contracts: sowContracts
            .filter((c) => drafts[c.id]?.selected)
            .map((c) => ({ id: c.id, assigned_hours: parseFloat(drafts[c.id].assignedHours) })),
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-sows"] });
      qc.invalidateQueries({ queryKey: ["mgmt-contracts"] });
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      onClose();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const activeMappings = components.filter(
    (m) => m.effectiveTo === null && sowContracts.some((c) => c.id === m.contractId)
  );
  const selectedIds = sowContracts.filter((c) => drafts[c.id]?.selected).map((c) => c.id);
  const startBeforeSowStart = !!sow && !!startDate && startDate <= fmtDate(sow.startDate);
  const canConfirm =
    !!startDate && selectedIds.length > 0 && !startBeforeSowStart && !renewMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    renewMutation.mutate();
  }

  return (
    <ManagementModal
      isOpen={sow !== null}
      onClose={onClose}
      title={sow ? `Renew SOW — ${sow.name}` : "Renew SOW"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError && <p className="text-sm text-destructive">{apiError}</p>}

        {/* Section 1 — Details */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New SOW Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Renewal Start *</Label>
              <DatePicker required value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <DatePicker clearable value={endDate} onChange={setEndDate} />
            </div>
          </div>
          {startBeforeSowStart && (
            <p className="text-xs text-destructive">
              Renewal start must be after the current SOW start ({fmtDate(sow!.startDate)}).
            </p>
          )}
        </div>

        {/* Section 2 — Contracts */}
        <div className="space-y-2">
          <Label>Contracts to Renew</Label>
          {contractsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : contractsError ? (
            <p className="text-sm text-destructive">Failed to load contracts.</p>
          ) : sowContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts to renew under this SOW.</p>
          ) : (
            <div className="space-y-2">
              {sowContracts.map((c) => {
                const d = drafts[c.id];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-md border p-2.5">
                    <Checkbox
                      checked={d?.selected ?? false}
                      onCheckedChange={(v) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...prev[c.id], selected: v === true },
                        }))
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.hourType}</p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={d?.assignedHours ?? ""}
                        disabled={!d?.selected}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], assignedHours: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3 — Mapping preview (read-only) */}
        {activeMappings.length > 0 && (
          <div className="space-y-2">
            <Label>Jira Mappings</Label>
            <div className="space-y-1.5">
              {activeMappings.map((m) => {
                const carried = selectedIds.includes(m.contractId);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border px-2.5 py-1.5"
                  >
                    <span className="font-mono text-xs">{m.componentKey}</span>
                    <span
                      className={
                        carried ? "text-xs text-[var(--safe)]" : "text-xs text-destructive"
                      }
                    >
                      {carried ? "carries forward" : "orphaned — no successor"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Carried mappings move to the renewed contract on the renewal date. Orphaned mappings
              (deselected contracts) are end-dated with no successor — future worklogs will be
              unmapped.
            </p>
          </div>
        )}

        {/* Section 4 — Confirm */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} contract{selectedIds.length === 1 ? "" : "s"} → new SOW
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canConfirm}>
              {renewMutation.isPending ? "Renewing…" : "Renew"}
            </Button>
          </div>
        </div>
      </form>
    </ManagementModal>
  );
}
