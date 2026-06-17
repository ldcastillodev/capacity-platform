"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/app/DatePicker";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { JIRA_INSTANCES } from "@/lib/constants";

interface ContractOption {
  id: number;
  name: string;
  startDate: string;
}
interface ComponentRecord {
  id: number;
  jiraInstance: string;
  componentKey: string;
  contractId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  contract: { id: number; name: string };
}
interface FormState {
  jira_instance: string;
  component_key: string;
  contract_id: string;
  effective_from: string;
}
const defaultForm: FormState = {
  jira_instance: "na",
  component_key: "",
  contract_id: "",
  effective_from: "",
};
function formatDate(iso: string) {
  return iso.split("T")[0];
}
function isComponentActive(comp: ComponentRecord) {
  return comp.effectiveTo === null || new Date(comp.effectiveTo) > new Date();
}

type ComponentCol = "jiraInstance" | "componentKey" | "contract" | "effectiveFrom" | "status";
const COMPONENT_ACCESSORS: Record<ComponentCol, (c: ComponentRecord) => string | number> = {
  jiraInstance: (c) => c.jiraInstance,
  componentKey: (c) => c.componentKey,
  contract: (c) => c.contract.name,
  effectiveFrom: (c) => c.effectiveFrom,
  status: (c) => (isComponentActive(c) ? "Active" : "Archived"),
};

export function ComponentsTab() {
  const sort = useSortState<ComponentCol>();
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ComponentRecord | null>(null);
  const [archiving, setArchiving] = useState<ComponentRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const qc = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["mgmt-components", showArchived],
    queryFn: () =>
      api
        .get<ComponentRecord[]>(`/management/components?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["mgmt-contracts-active"],
    queryFn: () => api.get<ContractOption[]>("/management/contracts").then((r) => r.data),
  });
  const visibleComponents = showArchived
    ? components.filter((c) => !isComponentActive(c))
    : components;
  const sortedComponents = useMemo(
    () =>
      sort.sortKey
        ? sortRows(visibleComponents, COMPONENT_ACCESSORS[sort.sortKey], sort.sortDir)
        : visibleComponents,
    [visibleComponents, sort.sortKey, sort.sortDir]
  );

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api
        .post("/management/components", {
          jira_instance: f.jira_instance,
          component_key: f.component_key,
          contract_id: Number(f.contract_id),
          effective_from: f.effective_from,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      closeModal();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      api
        .patch(`/management/components/${id}`, {
          jira_instance: f.jira_instance,
          contract_id: Number(f.contract_id),
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      closeModal();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/components/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
      setArchiving(null);
    },
  });
  const unarchiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/components/${id}/unarchive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-components"] });
    },
  });

  function openCreate() {
    setForm(defaultForm);
    setEditing(null);
    setModalMode("create");
  }
  function openEdit(comp: ComponentRecord) {
    setForm({
      jira_instance: comp.jiraInstance,
      component_key: comp.componentKey,
      contract_id: comp.contractId.toString(),
      effective_from: formatDate(comp.effectiveFrom),
    });
    setEditing(comp);
    setModalMode("edit");
  }
  function closeModal() {
    setModalMode(null);
    setEditing(null);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modalMode === "create") createMutation.mutate(form);
    else if (modalMode === "edit" && editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
        <Button size="sm" onClick={openCreate}>
          + Add Mapping
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : visibleComponents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No component mappings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead colKey="jiraInstance" sort={sort}>
                      Jira Instance
                    </SortableHead>
                    <SortableHead colKey="componentKey" sort={sort}>
                      Component Key
                    </SortableHead>
                    <SortableHead colKey="contract" sort={sort}>
                      Contract
                    </SortableHead>
                    <SortableHead colKey="effectiveFrom" sort={sort}>
                      Effective From
                    </SortableHead>
                    <SortableHead
                      colKey="status"
                      sort={sort}
                      align="center"
                      className="text-center"
                    >
                      Status
                    </SortableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedComponents.map((comp) => {
                    const isActive = isComponentActive(comp);
                    return (
                      <TableRow key={comp.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {comp.jiraInstance}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {comp.componentKey}
                        </TableCell>
                        <TableCell className="text-sm">{comp.contract.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(comp.effectiveFrom)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              isActive
                                ? "bg-[var(--safe-bg)] text-[var(--safe)] border-0"
                                : "bg-muted text-muted-foreground border-0"
                            }
                          >
                            {isActive ? "Active" : "Archived"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => openEdit(comp)}>
                              Edit
                            </Button>
                            {isActive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive text-destructive hover:bg-destructive/10"
                                onClick={() => setArchiving(comp)}
                              >
                                Archive
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]"
                                disabled={unarchiveMutation.isPending}
                                onClick={() => unarchiveMutation.mutate(comp.id)}
                              >
                                Unarchive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManagementModal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={
          modalMode === "create"
            ? "Add Component Mapping"
            : `Edit Mapping — ${editing?.componentKey}`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label>Jira Instance</Label>
              <Select
                value={form.jira_instance}
                onValueChange={(v) => setForm({ ...form, jira_instance: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JIRA_INSTANCES.map((j) => (
                    <SelectItem key={j.value} value={j.value}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Component Key *</Label>
              <Input
                required
                value={form.component_key}
                onChange={(e) => setForm({ ...form, component_key: e.target.value })}
                disabled={modalMode === "edit"}
                placeholder="e.g. MG-001"
              />
              {modalMode === "edit" && (
                <p className="text-xs text-muted-foreground">
                  Component key is immutable after creation.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Contract *</Label>
            <Select
              required
              value={form.contract_id}
              onValueChange={(v) => {
                const c = contracts.find((ct) => String(ct.id) === v);
                setForm({
                  ...form,
                  contract_id: v,
                  effective_from: c ? formatDate(c.startDate) : "",
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select contract —" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Effective From *</Label>
            <DatePicker required value={form.effective_from} onChange={() => {}} disabled />
            <p className="text-xs text-muted-foreground">
              {modalMode === "edit"
                ? "Effective date is immutable after creation."
                : "Inherited from the selected contract's start date."}
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </ManagementModal>

      <ArchiveConfirmDialog
        isOpen={archiving !== null}
        entityName={archiving?.componentKey ?? ""}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}
