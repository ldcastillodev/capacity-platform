"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/client";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { ManagementModal } from "./ManagementModal";
import { DeclarationForm } from "./DeclarationForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

const ROLE_LABELS: Record<string, string> = {
  dev: "Dev",
  qa: "QA",
  devops: "DevOps",
  design: "UX Designer",
  product: "Product Manager",
  project: "Project Manager",
  tl: "Tech Lead",
  sre: "Site Reliability Engineer",
  data: "Data Engineer",
  business_analyst: "Business Analyst",
  seo: "SEO",
  content: "Content",
};

function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

interface SquadOption {
  id: number;
  name: string;
}

interface DeclarationRoleRow {
  id: number;
  roleType: string;
  declaredHours: string;
}

interface DeclarationRow {
  id: number;
  contractId: number | null;
  clientId: number;
  squadId: number;
  month: string;
  status: "draft" | "confirmed";
  client: { id: number; name: string };
  squad: { id: number; name: string };
  contract: { id: number; name: string } | null;
  roles: DeclarationRoleRow[];
}

type ClientGroup = {
  clientId: number;
  clientName: string;
  decls: DeclarationRow[];
};

type DeclRoleCol = "role" | "hours";
const DECL_ROLE_ACCESSORS: Record<DeclRoleCol, (r: DeclarationRoleRow) => string | number> = {
  role: (r) => ROLE_LABELS[r.roleType] ?? r.roleType,
  hours: (r) => parseFloat(r.declaredHours),
};

function DeclarationsSection() {
  const qc = useQueryClient();
  const sort = useSortState<DeclRoleCol>();
  const [month, setMonth] = useMonth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDecl, setEditDecl] = useState<DeclarationRow | null>(null);
  const [editRoles, setEditRoles] = useState<Array<{ role_type: string; declared_hours: string }>>(
    []
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-declarations", month],
    queryFn: () =>
      api
        .get<DeclarationRow[]>("/management/declarations", { params: { month } })
        .then((r) => r.data),
  });
  const { data: squads = [] } = useQuery({
    queryKey: ["mgmt-squads-active"],
    queryFn: () => api.get<SquadOption[]>("/management/squads").then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      roles,
    }: {
      id: number;
      roles: Array<{ role_type: string; declared_hours: number }>;
    }) => api.patch(`/management/declarations/${id}`, { roles }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-declarations", month] });
      setEditDecl(null);
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/declarations/${id}/confirm`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-declarations", month] });
      setConfirmId(null);
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });

  function openEdit(decl: DeclarationRow) {
    setEditRoles(
      decl.roles.map((r) => ({
        role_type: r.roleType,
        declared_hours: String(parseFloat(r.declaredHours).toFixed(1)),
      }))
    );
    setEditDecl(decl);
    setApiError(null);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editDecl) return;
    setApiError(null);
    updateMut.mutate({
      id: editDecl.id,
      roles: editRoles.map((r) => ({
        role_type: r.role_type,
        declared_hours: parseFloat(r.declared_hours),
      })),
    });
  }

  function toggleClient(id: number) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // group by client
  const byClient = new Map<number, ClientGroup>();
  for (const d of rows) {
    if (!byClient.has(d.clientId)) {
      byClient.set(d.clientId, { clientId: d.clientId, clientName: d.client.name, decls: [] });
    }
    byClient.get(d.clientId)!.decls.push(d);
  }
  const clientGroups = Array.from(byClient.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <MonthNavigator month={month} onChange={setMonth} />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Add Declaration
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No declarations for {formatMonthDisplay(month)}.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clientGroups.map(({ clientId, clientName, decls }) => {
          const expanded = expandedClients.has(clientId);
          const confirmedCount = decls.filter((d) => d.status === "confirmed").length;
          return (
            <Card key={clientId} className="overflow-hidden">
              <CardHeader
                className="py-3 px-5 bg-muted/40 border-b flex-row items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleClient(clientId)}
              >
                <div className="flex items-center gap-2.5">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-bold text-base">{clientName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {confirmedCount}/{decls.length} confirmed
                  </Badge>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="p-0">
                  {decls.map((decl) => {
                    const isConfirmed = decl.status === "confirmed";
                    const totalHours = decl.roles.reduce(
                      (s, r) => s + parseFloat(r.declaredHours),
                      0
                    );
                    return (
                      <div key={decl.id} className="border-b last:border-b-0">
                        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/10 text-sm flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {decl.contract?.name ?? "No contract"}
                            </span>
                            <span className="text-muted-foreground">
                              · {decl.squad.name} · {totalHours.toFixed(0)}h total
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                isConfirmed
                                  ? "text-xs bg-green-50 text-green-700 border-green-200"
                                  : "text-xs bg-blue-50 text-blue-700 border-blue-200"
                              }
                            >
                              {isConfirmed ? "✓ Confirmed" : "Draft"}
                            </Badge>
                          </div>
                          <div className="flex gap-1.5">
                            {!isConfirmed && (
                              <Button size="sm" variant="outline" onClick={() => openEdit(decl)}>
                                Edit
                              </Button>
                            )}
                            {decl.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]"
                                onClick={() => {
                                  setConfirmId(decl.id);
                                  setApiError(null);
                                }}
                              >
                                Confirm
                              </Button>
                            )}
                          </div>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableHead colKey="role" sort={sort}>
                                Role
                              </SortableHead>
                              <SortableHead
                                colKey="hours"
                                sort={sort}
                                align="right"
                                className="text-right"
                              >
                                Declared Hours
                              </SortableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(sort.sortKey
                              ? sortRows(
                                  decl.roles,
                                  DECL_ROLE_ACCESSORS[sort.sortKey],
                                  sort.sortDir
                                )
                              : decl.roles
                            ).map((r) => (
                              <TableRow key={r.roleType}>
                                <TableCell>{ROLE_LABELS[r.roleType] ?? r.roleType}</TableCell>
                                <TableCell className="text-right">
                                  {parseFloat(r.declaredHours).toFixed(1)}h
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Create modal */}
      <ManagementModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Declaration"
      >
        <DeclarationForm
          squads={squads}
          onSuccess={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["mgmt-declarations", month] });
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </ManagementModal>

      {/* Edit modal — per-role hours */}
      <ManagementModal
        isOpen={editDecl !== null}
        onClose={() => setEditDecl(null)}
        title="Edit Declaration"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          {editRoles.map((r, i) => (
            <div key={r.role_type} className="space-y-1.5">
              <Label>{ROLE_LABELS[r.role_type] ?? r.role_type}</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                required
                value={r.declared_hours}
                onChange={(e) => {
                  const next = [...editRoles];
                  next[i] = { ...next[i], declared_hours: e.target.value };
                  setEditRoles(next);
                }}
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setEditDecl(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMut.isPending}>
              {updateMut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </ManagementModal>

      {/* Confirm dialog — no approver prompt */}
      <Dialog
        open={confirmId !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm declaration?</DialogTitle>
          </DialogHeader>
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <p className="text-sm text-muted-foreground">Declaration will be marked as confirmed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmId !== null && confirmMut.mutate(confirmId)}
              disabled={confirmMut.isPending}
            >
              {confirmMut.isPending ? "Confirming…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DeclarationsTab() {
  return <DeclarationsSection />;
}
