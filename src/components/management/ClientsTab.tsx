"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/app/DatePicker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function fmtDate(iso: string) { return iso.split("T")[0]; }
function errMsg(e: unknown) { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e); }

interface ClientRecord { id: number; name: string; region: string; currency: string; isActive: boolean; createdAt: string; }
interface ClientFormState { name: string; region: string; currency: string; }
const defaultClientForm: ClientFormState = { name: "", region: "na", currency: "USD" };

function ClientsSection() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [archiving, setArchiving] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<ClientFormState>(defaultClientForm);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["mgmt-clients", showArchived],
    queryFn: () => api.get<ClientRecord[]>(`/management/clients?includeArchived=${showArchived}`).then(r => r.data),
  });
  const createMutation = useMutation({
    mutationFn: (f: ClientFormState) => api.post("/management/clients", f).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: ClientFormState }) => api.patch(`/management/clients/${id}`, f).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); closeModal(); },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/clients/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); setArchiving(null); },
  });
  const unarchiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/clients/${id}/unarchive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-clients"] }); },
  });

  function openCreate() { setForm(defaultClientForm); setEditing(null); setModalMode("create"); }
  function openEdit(c: ClientRecord) { setForm({ name: c.name, region: c.region, currency: c.currency }); setEditing(c); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
        <Button size="sm" onClick={openCreate}>+ Add Client</Button>
      </div>
      <Card><CardContent className="p-0">
        {isLoading
          ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          : clients.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No clients found.</p>
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Region</TableHead><TableHead>Currency</TableHead>
                <TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader><TableBody>
                {clients.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: c.region === "na" ? "rgba(59,130,246,0.08)" : "rgba(99,102,241,0.08)", color: c.region === "na" ? "#2563eb" : "#6366f1", textTransform: "uppercase" }}>{c.region}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.currency}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={c.isActive ? "bg-[var(--safe-bg)] text-[var(--safe)] border-0" : "bg-muted text-muted-foreground border-0"}>{c.isActive ? "Active" : "Archived"}</Badge>
                    </TableCell>
                    <TableCell className="text-right"><div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Edit</Button>
                      {c.isActive
                        ? <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setArchiving(c)}>Archive</Button>
                        : <Button size="sm" variant="outline" className="border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]" disabled={unarchiveMutation.isPending} onClick={() => unarchiveMutation.mutate(c.id)}>Unarchive</Button>
                      }
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table></div>
        }
      </CardContent></Card>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Client" : `Edit Client — ${editing?.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5"><Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Client name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Region *</Label>
              <Select value={form.region} onValueChange={v => setForm({ ...form, region: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="na">NA</SelectItem><SelectItem value="emea">EMEA</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Currency *</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</Button>
          </div>
        </form>
      </ManagementModal>
      <ArchiveConfirmDialog isOpen={archiving !== null} entityName={archiving?.name ?? ""} onConfirm={() => archiving && archiveMutation.mutate(archiving.id)} onCancel={() => setArchiving(null)} isPending={archiveMutation.isPending} />
    </div>
  );
}

interface SowRecord { id: number; name: string; clientId: number; startDate: string; endDate: string | null; client: { id: number; name: string }; }
interface ClientOption { id: number; name: string; }
interface SowFormState { name: string; client_id: string; start_date: string; end_date: string; }

function SowsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SowRecord | null>(null);
  const [form, setForm] = useState<SowFormState>({ name: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: sows = [], isLoading } = useQuery({
    queryKey: ["mgmt-sows"],
    queryFn: () => api.get<SowRecord[]>("/management/statement-of-works").then(r => r.data),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["mgmt-clients-active"],
    queryFn: () => api.get<ClientOption[]>("/management/clients").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: SowFormState) => api.post("/management/statement-of-works", { name: f.name, client_id: Number(f.client_id), start_date: f.start_date, end_date: f.end_date || undefined }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: SowFormState }) => api.patch(`/management/statement-of-works/${id}`, { name: f.name, start_date: f.start_date, end_date: f.end_date || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/statement-of-works/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-sows"] }); setDeleteId(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  function openCreate() { setForm({ name: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(s: SowRecord) { setForm({ name: s.name, client_id: s.clientId.toString(), start_date: fmtDate(s.startDate), end_date: s.endDate ? fmtDate(s.endDate) : "" }); setEditing(s); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>+ Add SOW</Button>
      </div>
      <Card><CardContent className="p-0">
        {isLoading
          ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          : sows.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No statements of work found.</p>
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Client</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader><TableBody>
                {sows.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.client.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(s.startDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.endDate ? fmtDate(s.endDate) : "—"}</TableCell>
                    <TableCell className="text-right"><div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                      <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => { setApiError(null); setDeleteId(s.id); }}>Delete</Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table></div>
        }
      </CardContent></Card>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Statement of Work" : `Edit SOW — ${editing?.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5"><Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="SOW name" />
          </div>
          <div className="space-y-1.5"><Label>Client *</Label>
            <Select required value={form.client_id || "none"} onValueChange={v => setForm({ ...form, client_id: v === "none" ? "" : v })} disabled={modalMode === "edit"}>
              <SelectTrigger><SelectValue placeholder="— Select client —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select client —</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {modalMode === "edit" && <p className="text-xs text-muted-foreground">Client is immutable after creation.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start Date *</Label><DatePicker required value={form.start_date} onChange={v => setForm({ ...form, start_date: v })} /></div>
            <div className="space-y-1.5"><Label>End Date</Label><DatePicker clearable value={form.end_date} onChange={v => setForm({ ...form, end_date: v })} /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</Button>
          </div>
        </form>
      </ManagementModal>
      <ConfirmDialog
        open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}
        title="Delete SOW?" description="Cannot delete if contracts exist under this SOW."
        confirmLabel="Delete" destructive onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

interface ContractRecord { id: number; name: string; sowId: number; hourType: "monthly" | "total"; type: "base" | "change_order"; assignedHours: string; startDate: string; endDate: string | null; status: "active" | "paused" | "closed"; sow: { id: number; name: string; client: { id: number; name: string } }; }
interface SowOption { id: number; name: string; client: { id: number; name: string }; }
interface ContractFormState { name: string; sow_id: string; hour_type: "monthly" | "total"; type: "base" | "change_order"; assigned_hours: string; start_date: string; end_date: string; status: "active" | "paused" | "closed"; client_filter: string; }

function ContractsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ContractRecord | null>(null);
  const [form, setForm] = useState<ContractFormState>({ name: "", sow_id: "", hour_type: "monthly", type: "base", assigned_hours: "", start_date: new Date().toISOString().split("T")[0], end_date: "", status: "active", client_filter: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["mgmt-contracts"],
    queryFn: () => api.get<ContractRecord[]>("/management/contracts").then(r => r.data),
  });
  const { data: sows = [] } = useQuery({
    queryKey: ["mgmt-sows-with-clients"],
    queryFn: () => api.get<SowOption[]>("/management/statement-of-works").then(r => r.data),
  });
  const filteredSows = form.client_filter ? sows.filter(s => s.client.id.toString() === form.client_filter) : sows;
  const uniqueClients = Array.from(new Map(sows.map(s => [s.client.id, s.client])).values());

  const createMutation = useMutation({
    mutationFn: (f: ContractFormState) => api.post("/management/contracts", { name: f.name, sow_id: Number(f.sow_id), hour_type: f.hour_type, type: f.type, assigned_hours: parseFloat(f.assigned_hours), start_date: f.start_date, end_date: f.end_date || undefined, status: f.status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: ContractFormState }) => api.patch(`/management/contracts/${id}`, { name: f.name, hour_type: f.hour_type, type: f.type, assigned_hours: parseFloat(f.assigned_hours), start_date: f.start_date, end_date: f.end_date || null, status: f.status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); closeModal(); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/contracts/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-contracts"] }); setDeleteId(null); },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  function openCreate() { setForm({ name: "", sow_id: "", hour_type: "monthly", type: "base", assigned_hours: "", start_date: new Date().toISOString().split("T")[0], end_date: "", status: "active", client_filter: "" }); setEditing(null); setApiError(null); setModalMode("create"); }
  function openEdit(c: ContractRecord) { setForm({ name: c.name, sow_id: c.sowId.toString(), hour_type: c.hourType, type: c.type, assigned_hours: c.assignedHours, start_date: fmtDate(c.startDate), end_date: c.endDate ? fmtDate(c.endDate) : "", status: c.status, client_filter: c.sow.client.id.toString() }); setEditing(c); setApiError(null); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(null); setApiError(null); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setApiError(null); if (modalMode === "create") createMutation.mutate(form); else if (editing) updateMutation.mutate({ id: editing.id, f: form }); }
  const isPending = createMutation.isPending || updateMutation.isPending;

  const statusBadgeClass = (s: string) => ({
    active: "bg-[var(--safe-bg)] text-[var(--safe)] border-0",
    paused: "bg-[var(--watch-bg)] text-[var(--watch)] border-0",
    closed: "bg-muted text-muted-foreground border-0",
  }[s] ?? "bg-muted text-muted-foreground border-0");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>+ Add Contract</Button>
      </div>
      <Card><CardContent className="p-0">
        {isLoading
          ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          : contracts.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No contracts found.</p>
            : <div className="overflow-auto"><Table><TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>SOW</TableHead><TableHead>Client</TableHead>
                <TableHead>Type</TableHead><TableHead>Hours</TableHead>
                <TableHead>Start</TableHead><TableHead>End</TableHead>
                <TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader><TableBody>
                {contracts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.sow.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.sow.client.name}</TableCell>
                    <TableCell className="text-xs font-mono">{c.type.replace("_"," ")} / {c.hourType}</TableCell>
                    <TableCell className="text-sm text-right">{parseFloat(c.assignedHours).toFixed(0)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(c.startDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.endDate ? fmtDate(c.endDate) : "—"}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={statusBadgeClass(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell className="text-right"><div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Edit</Button>
                      <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => { setApiError(null); setDeleteId(c.id); }}>Delete</Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table></div>
        }
      </CardContent></Card>
      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Contract" : `Edit Contract — ${editing?.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5"><Label>Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contract name" />
          </div>
          {modalMode === "create" && (
            <div className="space-y-1.5"><Label>Filter by Client</Label>
              <Select value={form.client_filter || "all"} onValueChange={v => setForm({ ...form, client_filter: v === "all" ? "" : v, sow_id: "" })}>
                <SelectTrigger><SelectValue placeholder="— All clients —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">— All clients —</SelectItem>
                  {uniqueClients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Statement of Work *</Label>
            <Select required value={form.sow_id || "none"} onValueChange={v => setForm({ ...form, sow_id: v === "none" ? "" : v })} disabled={modalMode === "edit"}>
              <SelectTrigger><SelectValue placeholder="— Select SOW —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select SOW —</SelectItem>
                {filteredSows.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.client.name})</SelectItem>)}
              </SelectContent>
            </Select>
            {modalMode === "edit" && <p className="text-xs text-muted-foreground">SOW is immutable after creation.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Hour Type *</Label>
              <Select value={form.hour_type} onValueChange={v => setForm({ ...form, hour_type: v as "monthly"|"total" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="total">Total</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Contract Type *</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as "base"|"change_order" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="base">Base</SelectItem><SelectItem value="change_order">Change Order</SelectItem><SelectItem value="extension">Extension</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Assigned Hours *</Label><Input type="number" min="0" step="0.5" required value={form.assigned_hours} onChange={e => setForm({ ...form, assigned_hours: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start Date *</Label><DatePicker required value={form.start_date} onChange={v => setForm({ ...form, start_date: v })} /></div>
            <div className="space-y-1.5"><Label>End Date</Label><DatePicker clearable value={form.end_date} onChange={v => setForm({ ...form, end_date: v })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as "active"|"paused"|"closed" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : modalMode === "create" ? "Create" : "Save"}</Button>
          </div>
        </form>
      </ManagementModal>
      <ConfirmDialog
        open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}
        title="Delete Contract?" description="Cannot delete if declarations exist."
        confirmLabel="Delete" destructive onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

export function ClientsTab() {
  return (
    <Tabs defaultValue="clients">
      <TabsList className="mb-5">
        <TabsTrigger value="clients">Clients</TabsTrigger>
        <TabsTrigger value="sows">Statements of Work</TabsTrigger>
        <TabsTrigger value="contracts">Contracts</TabsTrigger>
      </TabsList>
      <TabsContent value="clients"><ClientsSection /></TabsContent>
      <TabsContent value="sows"><SowsSection /></TabsContent>
      <TabsContent value="contracts"><ContractsSection /></TabsContent>
    </Tabs>
  );
}
