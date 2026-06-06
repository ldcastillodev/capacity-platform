"use client";

import type React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import {
  confirmDeclaration,
  fetchClients,
  fetchDeclarations,
  fetchSquads,
  updateDeclaration,
  type Declaration,
  type DeclarationStatus,
} from "@/lib/client";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay, shiftMonth } from "@/hooks/useMonth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  dev: "Dev", qa: "QA", devops: "DevOps", design: "UX Designer",
  product: "Product Manager", project: "Project Manager", tl: "Tech Lead",
  sre: "Site Reliability Engineer", data: "Data Engineer",
  business_analyst: "Business Analyst", seo: "SEO",
};

const STATUS_CFG: Record<DeclarationStatus, { label: string; className: string }> = {
  derived:   { label: "⚡ Derived",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  draft:     { label: "Draft",         className: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "✓ Confirmed",   className: "bg-green-50 text-green-700 border-green-200" },
  locked:    { label: "🔒 Locked",     className: "bg-muted text-muted-foreground border-border" },
};

function DeclarationBadge({ status }: { status: DeclarationStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold whitespace-nowrap", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function EditableHours({ declaration, onSaved }: { declaration: Declaration; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(declaration.declared_hours);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const hours = parseFloat(inputVal);
    if (isNaN(hours) || hours < 0) { setEditing(false); return; }
    setSaving(true);
    try { await updateDeclaration(declaration.id, hours); onSaved(); }
    finally { setSaving(false); setEditing(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  if (saving) return <span className="text-xs text-muted-foreground">Saving…</span>;

  if (editing) return (
    <Input
      type="number" min="0" step="0.5" value={inputVal}
      onChange={(e) => setInputVal(e.target.value)}
      onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus
      className="w-20 h-7 text-sm"
    />
  );

  return (
    <span
      onClick={() => { setInputVal(declaration.declared_hours); setEditing(true); }}
      className="cursor-pointer inline-flex items-center gap-1"
    >
      {parseFloat(declaration.declared_hours).toFixed(1)}h
      <Pencil size={11} className="text-muted-foreground flex-shrink-0" />
    </span>
  );
}

export default function DeclarationsPage() {
  const [month, setMonth] = useMonth();
  const [confirmingSquads, setConfirmingSquads] = useState<Set<number>>(new Set());
  const [confirmingClients, setConfirmingClients] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: declarations, isLoading } = useQuery({
    queryKey: ["declarations", month],
    queryFn: () => fetchDeclarations({ month }),
  });

  const { data: squads } = useQuery({ queryKey: ["squads"], queryFn: fetchSquads });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => confirmDeclaration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["declarations", month] }),
  });

  const handleInvalidate = () => queryClient.invalidateQueries({ queryKey: ["declarations", month] });

  const handleConfirmAll = async (squadId: number, derivedDeclarations: Declaration[]) => {
    setConfirmingSquads((prev) => new Set(prev).add(squadId));
    try { await Promise.all(derivedDeclarations.map((d) => confirmDeclaration(d.id))); queryClient.invalidateQueries({ queryKey: ["declarations", month] }); }
    finally { setConfirmingSquads((prev) => { const n = new Set(prev); n.delete(squadId); return n; }); }
  };

  const handleConfirmClient = async (clientId: number, derivedDeclarations: Declaration[]) => {
    setConfirmingClients((prev) => new Set(prev).add(clientId));
    try { await Promise.all(derivedDeclarations.map((d) => confirmDeclaration(d.id))); queryClient.invalidateQueries({ queryKey: ["declarations", month] }); }
    finally { setConfirmingClients((prev) => { const n = new Set(prev); n.delete(clientId); return n; }); }
  };

  const squadMap = Object.fromEntries((squads ?? []).map((s) => [s.id, s.name]));
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  type ClientGroup = { clientId: number; rows: Declaration[] };
  type SquadGroup = { squadId: number | null; clientGroups: ClientGroup[] };

  const bySquad = new Map<number | null, Map<number, Declaration[]>>();
  for (const decl of declarations ?? []) {
    const squadKey = decl.squad_id;
    if (!bySquad.has(squadKey)) bySquad.set(squadKey, new Map());
    const cMap = bySquad.get(squadKey)!;
    if (!cMap.has(decl.client_id)) cMap.set(decl.client_id, []);
    cMap.get(decl.client_id)!.push(decl);
  }

  const squadGroups: SquadGroup[] = Array.from(bySquad.entries())
    .map(([squadId, cMap]) => ({
      squadId,
      clientGroups: Array.from(cMap.entries())
        .map(([clientId, rows]) => ({ clientId, rows }))
        .sort((a, b) => (clientMap[a.clientId] ?? "").localeCompare(clientMap[b.clientId] ?? "")),
    }))
    .sort((a, b) => {
      const nameA = a.squadId != null ? (squadMap[a.squadId] ?? `Squad ${a.squadId}`) : "—";
      const nameB = b.squadId != null ? (squadMap[b.squadId] ?? `Squad ${b.squadId}`) : "—";
      return nameA.localeCompare(nameB);
    });

  const allDerived = (declarations ?? []).filter((d) => d.status === "derived");
  const prevMonthDisplay = formatMonthDisplay(shiftMonth(month, -1));

  return (
    <div>
      <PageHeader
        title="Declarations"
        description={`${formatMonthDisplay(month)} · Role allocation per squad and client`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      )}

      {!isLoading && allDerived.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-5 text-sm text-amber-800">
          <strong>{allDerived.length}</strong> declaration{allDerived.length !== 1 ? "s" : ""} auto-derived from <strong>{prevMonthDisplay}</strong>. Review hours and confirm to lock them in.
        </div>
      )}

      {!isLoading && (declarations ?? []).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No declarations found for this period. Run analytics refresh to generate derived declarations.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {squadGroups.map(({ squadId, clientGroups }) => {
          const squadName = squadId != null ? (squadMap[squadId] ?? `Squad ${squadId}`) : "Unassigned";
          const allDecls = clientGroups.flatMap((cg) => cg.rows);
          const confirmedCount = allDecls.filter((d) => d.status === "confirmed" || d.status === "locked").length;
          const derivedInSquad = allDecls.filter((d) => d.status === "derived");
          const isConfirmingAll = confirmingSquads.has(squadId ?? -1);

          return (
            <Card key={squadId ?? "null"} className="overflow-hidden">
              <CardHeader className="py-3 px-5 bg-muted/40 border-b flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-base">{squadName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {confirmedCount}/{allDecls.length} confirmed
                  </Badge>
                </div>
                {derivedInSquad.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleConfirmAll(squadId ?? -1, derivedInSquad)}
                    disabled={isConfirmingAll}
                    className="bg-[var(--safe)] hover:bg-[var(--safe)]/90 text-white text-xs"
                  >
                    {isConfirmingAll ? "Confirming…" : "Confirm All Derived"}
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-0">
                {clientGroups.map(({ clientId, rows }) => {
                  const clientName = clientMap[clientId] ?? `Client ${clientId}`;
                  const poolTotal = rows.reduce((sum, d) => sum + parseFloat(d.declared_hours), 0);
                  const derivedInClient = rows.filter((d) => d.status === "derived");
                  const allConfirmed = rows.every((d) => d.status === "confirmed" || d.status === "locked");
                  const isConfirmingClient = confirmingClients.has(clientId);

                  return (
                    <div key={clientId}>
                      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/20 border-b text-sm flex-wrap">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold">{clientName}</span>
                          <span className="text-muted-foreground">Pool: {poolTotal.toFixed(0)}h</span>
                          {allConfirmed
                            ? <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">✓ All confirmed</Badge>
                            : derivedInClient.length > 0
                              ? <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">{derivedInClient.length} derived</Badge>
                              : null
                          }
                        </div>
                        {derivedInClient.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirmClient(clientId, derivedInClient)}
                            disabled={isConfirmingClient}
                            className="text-[var(--safe)] border-[var(--safe)] hover:bg-[var(--safe-bg)] text-xs"
                          >
                            {isConfirmingClient ? "Confirming…" : "Confirm All"}
                          </Button>
                        )}
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Role</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((decl) => {
                            const roleLabel = ROLE_LABELS[decl.role_type] ?? decl.role_type;
                            const isEditable = decl.status !== "locked";
                            return (
                              <TableRow key={decl.id}>
                                <TableCell>{roleLabel}</TableCell>
                                <TableCell>
                                  {isEditable
                                    ? <EditableHours declaration={decl} onSaved={handleInvalidate} />
                                    : <span>{parseFloat(decl.declared_hours).toFixed(1)}h</span>}
                                </TableCell>
                                <TableCell><DeclarationBadge status={decl.status} /></TableCell>
                                <TableCell className="text-right">
                                  {(decl.status === "derived" || decl.status === "draft") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => confirmMutation.mutate(decl.id)}
                                      disabled={confirmMutation.isPending}
                                      className="text-[var(--safe)] border-[var(--safe)] hover:bg-[var(--safe-bg)] text-xs"
                                    >
                                      Confirm
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
