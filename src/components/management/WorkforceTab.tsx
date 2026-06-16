"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { ManagementModal } from "./ManagementModal";
import { SquadsTab } from "./SquadsTab";
import { PersonsTab } from "./PersonsTab";
import { ArchiveConfirmDialog } from "./ArchiveConfirmDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/app/DatePicker";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

const ROLE_TYPES = [
  "dev",
  "devops",
  "qa",
  "design",
  "product",
  "project",
  "tl",
  "sre",
  "data",
  "seo",
  "content",
];
const SENIORITIES = ["L1", "L2", "L3", "L4", "L5"];

interface SquadOption {
  id: number;
  name: string;
}
interface PersonOption {
  id: number;
  name: string;
}

// ── Memberships ───────────────────────────────────────────────────────────────

interface MembershipRow {
  id: number;
  personId: number;
  squadId: number;
  allocationPct: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  person: { id: number; name: string };
  squad: { id: number; name: string };
}

function MembershipsSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [form, setForm] = useState({
    person_id: "",
    squad_id: "",
    allocation_pct: "100",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
  });
  const [archiving, setArchiving] = useState<MembershipRow | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-memberships"],
    queryFn: () => api.get<MembershipRow[]>("/management/squad-memberships").then((r) => r.data),
  });
  const { data: squads = [] } = useQuery({
    queryKey: ["mgmt-squads-active"],
    queryFn: () => api.get<SquadOption[]>("/management/squads").then((r) => r.data),
  });
  const { data: persons = [] } = useQuery({
    queryKey: ["mgmt-persons-active"],
    queryFn: () => api.get<PersonOption[]>("/management/persons").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api
        .post("/management/squad-memberships", {
          person_id: Number(f.person_id),
          squad_id: Number(f.squad_id),
          allocation_pct: parseFloat(f.allocation_pct) / 100,
          effective_from: f.effective_from,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-memberships"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) =>
      api
        .patch(`/management/squad-memberships/${id}`, {
          allocation_pct: parseFloat(f.allocation_pct) / 100,
          effective_to: f.effective_to || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-memberships"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/management/squad-memberships/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-memberships"] });
      setArchiving(null);
    },
    onError: (e: unknown) => {
      toast.error(errMsg(e));
      setArchiving(null);
    },
  });

  function openCreate() {
    setForm({
      person_id: "",
      squad_id: "",
      allocation_pct: "100",
      effective_from: new Date().toISOString().split("T")[0],
      effective_to: "",
    });
    setEditing(null);
    setApiError(null);
    setModalMode("create");
  }
  function openEdit(row: MembershipRow) {
    setForm({
      person_id: row.personId.toString(),
      squad_id: row.squadId.toString(),
      allocation_pct: (parseFloat(row.allocationPct) * 100).toFixed(0),
      effective_from: row.effectiveFrom.split("T")[0],
      effective_to: row.effectiveTo ? row.effectiveTo.split("T")[0] : "",
    });
    setEditing(row);
    setApiError(null);
    setModalMode("edit");
  }
  function closeModal() {
    setModalMode(null);
    setEditing(null);
    setApiError(null);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          + Add Membership
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
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No memberships found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead className="text-right">Allocation %</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.person.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.squad.name}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {(parseFloat(row.allocationPct) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.effectiveFrom.split("T")[0]}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setArchiving(row)}
                          >
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ManagementModal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Membership" : "Edit Membership"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5">
            <Label>Person *</Label>
            <Select
              required
              value={form.person_id || "none"}
              onValueChange={(v) => setForm({ ...form, person_id: v === "none" ? "" : v })}
              disabled={modalMode === "edit"}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select person —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select person —</SelectItem>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Squad *</Label>
            <Select
              required
              value={form.squad_id || "none"}
              onValueChange={(v) => setForm({ ...form, squad_id: v === "none" ? "" : v })}
              disabled={modalMode === "edit"}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select squad —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select squad —</SelectItem>
                {squads.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Allocation %</Label>
              <Input
                type="number"
                min="1"
                max="100"
                step="1"
                value={form.allocation_pct}
                onChange={(e) => setForm({ ...form, allocation_pct: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From *</Label>
              <DatePicker
                required
                value={form.effective_from}
                onChange={(v) => setForm({ ...form, effective_from: v })}
                disabled={modalMode === "edit"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <DatePicker
                clearable
                value={form.effective_to}
                onChange={(v) => setForm({ ...form, effective_to: v })}
              />
            </div>
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
        entityName={archiving ? `${archiving.person.name} → ${archiving.squad.name}` : ""}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}

// ── Person Roles ──────────────────────────────────────────────────────────────

interface RoleRow {
  id: number;
  personId: number;
  roleType: string;
  seniority: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  person: { id: number; name: string };
}

function PersonRolesSection() {
  const qc = useQueryClient();
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({
    person_id: "",
    role_type: "dev",
    seniority: "",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
  });
  const [archiving, setArchiving] = useState<RoleRow | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-person-roles"],
    queryFn: () => api.get<RoleRow[]>("/management/person-roles").then((r) => r.data),
  });
  const { data: persons = [] } = useQuery({
    queryKey: ["mgmt-persons-active"],
    queryFn: () => api.get<PersonOption[]>("/management/persons").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api
        .post("/management/person-roles", {
          person_id: Number(f.person_id),
          role_type: f.role_type,
          seniority: f.seniority || undefined,
          effective_from: f.effective_from,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) =>
      api
        .patch(`/management/person-roles/${id}`, {
          seniority: f.seniority || null,
          effective_to: f.effective_to || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/person-roles/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-person-roles"] });
      setArchiving(null);
    },
    onError: (e: unknown) => {
      toast.error(errMsg(e));
      setArchiving(null);
    },
  });

  function openCreate() {
    setForm({
      person_id: "",
      role_type: "dev",
      seniority: "",
      effective_from: new Date().toISOString().split("T")[0],
      effective_to: "",
    });
    setEditing(null);
    setApiError(null);
    setModalMode("create");
  }
  function openEdit(row: RoleRow) {
    setForm({
      person_id: row.personId.toString(),
      role_type: row.roleType,
      seniority: row.seniority ?? "",
      effective_from: row.effectiveFrom.split("T")[0],
      effective_to: row.effectiveTo ? row.effectiveTo.split("T")[0] : "",
    });
    setEditing(row);
    setApiError(null);
    setModalMode("edit");
  }
  function closeModal() {
    setModalMode(null);
    setEditing(null);
    setApiError(null);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (modalMode === "create") createMutation.mutate(form);
    else if (editing) updateMutation.mutate({ id: editing.id, f: form });
  }
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          + Add Role
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
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No roles found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Seniority</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.person.name}</TableCell>
                      <TableCell className="text-sm">{row.roleType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.seniority ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.effectiveFrom.split("T")[0]}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.effectiveTo ? row.effectiveTo.split("T")[0] : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setArchiving(row)}
                          >
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ManagementModal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Person Role" : "Edit Person Role"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5">
            <Label>Person *</Label>
            <Select
              required
              value={form.person_id || "none"}
              onValueChange={(v) => setForm({ ...form, person_id: v === "none" ? "" : v })}
              disabled={modalMode === "edit"}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select person —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select person —</SelectItem>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role Type *</Label>
              <Select
                value={form.role_type}
                onValueChange={(v) => setForm({ ...form, role_type: v })}
                disabled={modalMode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Seniority</Label>
              <Select
                value={form.seniority || "none"}
                onValueChange={(v) => setForm({ ...form, seniority: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {SENIORITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From *</Label>
              <DatePicker
                required
                value={form.effective_from}
                onChange={(v) => setForm({ ...form, effective_from: v })}
                disabled={modalMode === "edit"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <DatePicker
                clearable
                value={form.effective_to}
                onChange={(v) => setForm({ ...form, effective_to: v })}
              />
            </div>
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
        entityName={
          archiving ? `${archiving.person.name} — ${archiving.roleType.replace(/_/g, " ")}` : ""
        }
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
        onCancel={() => setArchiving(null)}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function WorkforceTab() {
  return (
    <Tabs defaultValue="squads">
      <TabsList className="mb-5 flex-wrap h-auto">
        <TabsTrigger value="squads">Squads</TabsTrigger>
        <TabsTrigger value="persons">Persons</TabsTrigger>
        <TabsTrigger value="memberships">Squad Memberships</TabsTrigger>
        <TabsTrigger value="roles">Person Roles</TabsTrigger>
      </TabsList>
      <TabsContent value="squads">
        <SquadsTab />
      </TabsContent>
      <TabsContent value="persons">
        <PersonsTab />
      </TabsContent>
      <TabsContent value="memberships">
        <MembershipsSection />
      </TabsContent>
      <TabsContent value="roles">
        <PersonRolesSection />
      </TabsContent>
    </Tabs>
  );
}
