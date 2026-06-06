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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonOption { id: number; name: string; isActive: boolean; }
interface SquadRecord {
  id: number; name: string; isActive: boolean;
  lead: { id: number; name: string } | null;
  members: { id: number }[];
}
interface FormState { name: string; lead_person_id: string; }
const defaultForm: FormState = { name: "", lead_person_id: "" };

export function SquadsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SquadRecord | null>(null);
  const [archiving, setArchiving] = useState<SquadRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const qc = useQueryClient();

  const { data: squads = [], isLoading } = useQuery({
    queryKey: ["mgmt-squads", showArchived],
    queryFn: () => api.get<SquadRecord[]>(`/management/squads?includeArchived=${showArchived}`).then(r => r.data),
  });
  const { data: persons = [] } = useQuery({
    queryKey: ["mgmt-persons-active"],
    queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post("/management/squads", {
      name: f.name, lead_person_id: f.lead_person_id ? Number(f.lead_person_id) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) => api.patch(`/management/squads/${id}`, {
      name: f.name, lead_person_id: f.lead_person_id ? Number(f.lead_person_id) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); closeModal(); },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/squads/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); setArchiving(null); },
  });
  const unarchiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/squads/${id}/unarchive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-squads"] }); },
  });

  function openCreate() { setForm(defaultForm); setEditing(null); setModalMode("create"); }
  function openEdit(squad: SquadRecord) {
    setForm({ name: squad.name, lead_person_id: squad.lead?.id?.toString() ?? "" });
    setEditing(squad); setModalMode("edit");
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
        <Button size="sm" onClick={openCreate}>+ Add Squad</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : squads.length === 0
              ? <p className="p-6 text-sm text-muted-foreground">No squads found.</p>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Lead</TableHead>
                        <TableHead className="text-right">Active Members</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {squads.map((squad) => (
                        <TableRow key={squad.id}>
                          <TableCell className="font-medium text-sm">{squad.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{squad.lead?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-right">{squad.members.length}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={squad.isActive ? "bg-[var(--safe-bg)] text-[var(--safe)] border-0" : "bg-muted text-muted-foreground border-0"}>
                              {squad.isActive ? "Active" : "Archived"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => openEdit(squad)}>Edit</Button>
                              {squad.isActive
                                ? <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setArchiving(squad)}>Archive</Button>
                                : <Button size="sm" variant="outline" className="border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]" disabled={unarchiveMutation.isPending} onClick={() => unarchiveMutation.mutate(squad.id)}>Unarchive</Button>
                              }
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
          }
        </CardContent>
      </Card>

      <ManagementModal
        isOpen={modalMode !== null} onClose={closeModal}
        title={modalMode === "create" ? "Add Squad" : `Edit Squad — ${editing?.name}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Squad name" />
          </div>
          <div className="space-y-1.5">
            <Label>Lead Person</Label>
            <Select value={form.lead_person_id || "none"} onValueChange={v => setForm({ ...form, lead_person_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="— No lead —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No lead —</SelectItem>
                {persons.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
