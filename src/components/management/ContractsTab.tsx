"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  active: { bg: "var(--safe-bg)", color: "var(--safe)" },
  confirmed: { bg: "var(--safe-bg)", color: "var(--safe)" },
  approved: { bg: "var(--safe-bg)", color: "var(--safe)" },
  paused: { bg: "var(--watch-bg)", color: "var(--watch)" },
  pending_approval: { bg: "var(--watch-bg)", color: "var(--watch)" },
  pending_written: { bg: "var(--watch-bg)", color: "var(--watch)" },
  pending_docusign: { bg: "var(--warning-bg)", color: "var(--warning)" },
  requested: { bg: "var(--warning-bg)", color: "var(--warning)" },
  draft: { bg: "var(--warning-bg)", color: "var(--warning)" },
  closed: { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  rejected: { bg: "var(--critical-bg)", color: "var(--critical)" },
  locked: { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  derived: { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_TONE[status] ?? { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function errMsg(e: unknown) { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e); }

const ROLE_TYPES = ["dev","devops","qa","design","product","project","tl","sre","data","seo","content"];

interface ClientOption { id: number; name: string }
interface SquadOption  { id: number; name: string }
interface PersonOption { id: number; name: string }

interface DeclarationRow {
  id: number; contractId: number | null;
  clientId: number; squadId: number; month: string;
  roleType: string; declaredHours: string; status: string;
  submittedBy: number | null;
  client: ClientOption; squad: SquadOption;
}

function DeclarationsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<DeclarationRow | null>(null);
  const [form, setForm] = useState({ client_id: "", squad_id: "", month: "", role_type: "dev", declared_hours: "", contract_id: "", override_reason: "" });
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<DeclarationRow | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "lock" | null>(null);
  const [actionForm, setActionForm] = useState({ submitted_by: "" });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["mgmt-declarations"], queryFn: () => api.get<DeclarationRow[]>("/management/declarations").then(r => r.data) });
  const { data: clients = [] } = useQuery({ queryKey: ["mgmt-clients"], queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data) });
  const { data: squads  = [] } = useQuery({ queryKey: ["mgmt-squads-active"], queryFn: () => api.get<SquadOption[]>("/management/squads").then(r => r.data) });
  const { data: persons = [] } = useQuery({ queryKey: ["mgmt-persons-active"], queryFn: () => api.get<PersonOption[]>("/management/persons").then(r => r.data) });

  const createMut = useMutation({
    mutationFn: (f: typeof form) => api.post("/management/declarations", { client_id: Number(f.client_id), squad_id: Number(f.squad_id), month: f.month + "-01", role_type: f.role_type, declared_hours: Number(f.declared_hours), ...(f.contract_id ? { contract_id: Number(f.contract_id) } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) => api.patch(`/management/declarations/${id}`, { declared_hours: Number(f.declared_hours), ...(f.override_reason ? { override_reason: f.override_reason } : {}) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const confirmMut = useMutation({
    mutationFn: ({ id, submitted_by }: { id: number; submitted_by: number }) => api.post(`/management/declarations/${id}/confirm`, { submitted_by }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });
  const lockMut = useMutation({
    mutationFn: (id: number) => api.post(`/management/declarations/${id}/lock`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-declarations"] }); closeAction(); },
    onError: (e: unknown) => setActionError(errMsg(e)),
  });

  function openCreate() { setForm({ client_id: "", squad_id: "", month: "", role_type: "dev", declared_hours: "", contract_id: "", override_reason: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(row: DeclarationRow) { setForm({ client_id: row.clientId.toString(), squad_id: row.squadId.toString(), month: row.month.split("T")[0].slice(0,7), role_type: row.roleType, declared_hours: parseFloat(row.declaredHours).toFixed(0), contract_id: row.contractId?.toString() ?? "", override_reason: "" }); setEditing(row); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function closeAction() { setActionRow(null); setActionType(null); setActionError(null); setActionForm({ submitted_by: "" }); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMut.mutate(form); else if (editing) updateMut.mutate({ id: editing.id, f: form }); }
  function handleAction() {
    if (!actionRow || !actionType) return;
    if (actionType === "confirm") { if (!actionForm.submitted_by) { setActionError("submitted_by is required."); return; } confirmMut.mutate({ id: actionRow.id, submitted_by: Number(actionForm.submitted_by) }); }
    if (actionType === "lock") lockMut.mutate(actionRow.id);
  }
  const isPending = createMut.isPending || updateMut.isPending;
  const isActionPending = confirmMut.isPending || lockMut.isPending;
  const TERMINAL_DECL = ["locked", "derived"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>+ Add Declaration</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : rows.length === 0
              ? <p className="p-6 text-sm text-muted-foreground">No declarations found.</p>
              : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead><TableHead>Squad</TableHead><TableHead>Month</TableHead>
                        <TableHead>Role</TableHead><TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const isTerminal = TERMINAL_DECL.includes(row.status);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium text-sm">{row.client.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.squad.name}</TableCell>
                            <TableCell className="text-sm">{row.month.split("T")[0].slice(0,7)}</TableCell>
                            <TableCell className="text-xs">{row.roleType.replace(/_/g," ")}</TableCell>
                            <TableCell className="text-sm text-right">{parseFloat(row.declaredHours).toFixed(0)}</TableCell>
                            <TableCell><StatusBadge status={row.status} /></TableCell>
                            <TableCell className="text-right">
                              {isTerminal
                                ? <span className="text-xs text-muted-foreground">Read-only</span>
                                : (
                                  <div className="flex gap-1.5 justify-end flex-wrap">
                                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                                    {row.status === "draft" && (
                                      <Button size="sm" variant="outline" className="border-[var(--watch)] text-[var(--watch)] hover:bg-[var(--watch-bg)]"
                                        onClick={() => { setActionRow(row); setActionType("confirm"); setActionError(null); setActionForm({ submitted_by: "" }); }}>Confirm</Button>
                                    )}
                                    {row.status === "confirmed" && (
                                      <Button size="sm" variant="outline" className="text-muted-foreground"
                                        onClick={() => { setActionRow(row); setActionType("lock"); setActionError(null); }}>Lock</Button>
                                    )}
                                  </div>
                                )
                              }
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

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "New Declaration" : "Edit Declaration"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          {modalMode === "create" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Client *</Label>
                  <Select required value={form.client_id || "none"} onValueChange={v => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="— Select client —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select client —</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Squad *</Label>
                  <Select required value={form.squad_id || "none"} onValueChange={v => setForm({ ...form, squad_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="— Select squad —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select squad —</SelectItem>
                      {squads.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Month *</Label>
                  <Input type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role Type *</Label>
                  <Select value={form.role_type} onValueChange={v => setForm({ ...form, role_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLE_TYPES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Contract ID</Label>
                <Input type="number" min="1" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} placeholder="optional" />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Declared Hours *</Label>
            <Input type="number" min="0" step="0.5" required value={form.declared_hours} onChange={e => setForm({ ...form, declared_hours: e.target.value })} />
          </div>
          {modalMode === "edit" && (
            <div className="space-y-1.5">
              <Label>Override Reason</Label>
              <Input type="text" value={form.override_reason} onChange={e => setForm({ ...form, override_reason: e.target.value })} />
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

      <Dialog open={actionRow !== null && actionType !== null} onOpenChange={v => { if (!v) closeAction(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} declaration?</DialogTitle>
          </DialogHeader>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          {actionType === "confirm" && (
            <div className="space-y-1.5">
              <Label>Submitted By (Person) *</Label>
              <Select value={actionForm.submitted_by || "none"} onValueChange={v => setActionForm({ submitted_by: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— Select person —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select person —</SelectItem>
                  {persons.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {actionType === "lock" && <p className="text-sm text-muted-foreground">Declaration will be locked. No further edits possible.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>Cancel</Button>
            <Button onClick={handleAction} disabled={isActionPending}>
              {isActionPending ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ContractsTab() {
  return <DeclarationsSection />;
}
