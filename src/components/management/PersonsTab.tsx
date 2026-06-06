"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface SquadOption { id: number; name: string; }
interface PersonRecord {
  id: number; name: string; email: string; isActive: boolean;
  weeklyCapacityHours: string;
  squadMemberships: Array<{ id: number; squadId: number; allocationPct: string; squad: { id: number; name: string }; }>;
}
interface FormState { name: string; email: string; weekly_capacity_hours: string; squad_id: string; allocation_pct: string; }
const defaultForm: FormState = { name: "", email: "", weekly_capacity_hours: "40", squad_id: "", allocation_pct: "100" };

export function PersonsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<PersonRecord | null>(null);
  const [archiving, setArchiving] = useState<PersonRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const qc = useQueryClient();

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["mgmt-persons", showArchived],
    queryFn: () => api.get<PersonRecord[]>(`/management/persons?includeArchived=${showArchived}`).then(r => r.data),
  });
  const { data: squads = [] } = useQuery({
    queryKey: ["mgmt-squads-active"],
    queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post("/management/persons", {
      name: f.name, email: f.email,
      weekly_capacity_hours: parseFloat(f.weekly_capacity_hours) || 40,
      squad_id: f.squad_id ? Number(f.squad_id) : null,
      allocation_pct: f.squad_id ? parseFloat(f.allocation_pct) / 100 : undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-persons"] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) => api.patch(`/management/persons/${id}`, {
      name: f.name, email: f.email,
      weekly_capacity_hours: parseFloat(f.weekly_capacity_hours) || 40,
      squad_id: f.squad_id ? Number(f.squad_id) : null,
      allocation_pct: f.squad_id ? parseFloat(f.allocation_pct) / 100 : undefined,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-persons"] }); qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); closeModal(); },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/persons/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-persons"] }); qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); setArchiving(null); },
  });
  const unarchiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/persons/${id}/unarchive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-persons"] }); },
  });

  function openCreate() { setForm(defaultForm); setEditing(null); setModalMode("create"); }
  function openEdit(person: PersonRecord) {
    const currentSquad = person.squadMemberships[0];
    setForm({
      name: person.name, email: person.email,
      weekly_capacity_hours: parseFloat(person.weeklyCapacityHours).toString(),
      squad_id: currentSquad?.squadId?.toString() ?? "",
      allocation_pct: currentSquad ? (parseFloat(currentSquad.allocationPct) * 100).toString() : "100",
    });
    setEditing(person); setModalMode("edit");
  }
  function closeModal() { setModalMode(null); setEditing(null); }
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
        <Button size="sm" onClick={openCreate}>+ Add Person</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : persons.length === 0
              ? <p className="p-6 text-sm text-muted-foreground">No persons found.</p>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Squad</TableHead>
                        <TableHead className="text-right">Hrs/wk</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persons.map((person) => {
                        const squad = person.squadMemberships[0];
                        return (
                          <TableRow key={person.id}>
                            <TableCell className="font-medium text-sm">{person.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{person.email}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {squad ? `${squad.squad.name} (${(parseFloat(squad.allocationPct) * 100).toFixed(0)}%)` : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-right">{parseFloat(person.weeklyCapacityHours).toFixed(0)}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={person.isActive ? "bg-[var(--safe-bg)] text-[var(--safe)] border-0" : "bg-muted text-muted-foreground border-0"}>
                                {person.isActive ? "Active" : "Archived"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => openEdit(person)}>Edit</Button>
                                {person.isActive
                                  ? <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setArchiving(person)}>Archive</Button>
                                  : <Button size="sm" variant="outline" className="border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]" disabled={unarchiveMutation.isPending} onClick={() => unarchiveMutation.mutate(person.id)}>Unarchive</Button>
                                }
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
          }
        </CardContent>
      </Card>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal}
        title={modalMode === "create" ? "Add Person" : `Edit Person — ${editing?.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Weekly Hours</Label>
            <Input type="number" min="1" max="80" step="0.5" value={form.weekly_capacity_hours} onChange={e => setForm({ ...form, weekly_capacity_hours: e.target.value })} />
          </div>
          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Squad Assignment</p>
          <div className="space-y-1.5">
            <Label>Squad</Label>
            <Select value={form.squad_id || "none"} onValueChange={v => setForm({ ...form, squad_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="— No squad —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No squad —</SelectItem>
                {squads.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.squad_id && (
            <div className="space-y-1.5">
              <Label>Allocation %</Label>
              <Input type="number" min="1" max="100" step="1" value={form.allocation_pct} onChange={e => setForm({ ...form, allocation_pct: e.target.value })} />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </ManagementModal>

      <ArchiveConfirmDialog
        isOpen={archiving !== null} entityName={archiving?.name ?? ""}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)} isPending={archiveMutation.isPending}
      />
    </div>
  );
}
