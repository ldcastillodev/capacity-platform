"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function errMsg(e: unknown) { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e); }

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  active:       { bg: "var(--safe-bg)",     color: "var(--safe)" },
  open:         { bg: "var(--watch-bg)",    color: "var(--watch)" },
  acknowledged: { bg: "var(--warning-bg)",  color: "var(--warning)" },
  applied:      { bg: "var(--safe-bg)",     color: "var(--safe)" },
  dismissed:    { bg: "hsl(var(--muted))",  color: "hsl(var(--muted-foreground))" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_TONE[status] ?? { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Anomaly Flags ────────────────────────────────────────────────────────────

interface AnomalyRow {
  id: number; clientId: number; month: string; roleType: string | null;
  flagType: string; severity: string; explanation: string; detectedAt: string;
  resolvedAt: string | null; client: { id: number; name: string };
}

function AnomalyFlagsSection() {
  const qc = useQueryClient();
  const [resolveRow, setResolveRow] = useState<AnomalyRow | null>(null);
  const [resolveForm, setResolveForm] = useState({ resolved_by: "", resolution_notes: "" });
  const [resolveError, setResolveError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-anomaly-flags"],
    queryFn: () => api.get<AnomalyRow[]>("/management/analytics/anomaly-flags").then(r => r.data),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { resolved_by?: number; resolution_notes: string } }) =>
      api.post(`/management/analytics/anomaly-flags/${id}/resolve`, body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-anomaly-flags"] }); closeResolve(); },
    onError: (e: unknown) => setResolveError(errMsg(e)),
  });

  function openResolve(row: AnomalyRow) {
    setResolveRow(row); setResolveForm({ resolved_by: "", resolution_notes: "" }); setResolveError(null);
  }
  function closeResolve() {
    setResolveRow(null); setResolveForm({ resolved_by: "", resolution_notes: "" }); setResolveError(null);
  }
  function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveRow) return;
    if (!resolveForm.resolution_notes.trim()) { setResolveError("Resolution notes are required."); return; }
    const body: { resolved_by?: number; resolution_notes: string } = { resolution_notes: resolveForm.resolution_notes };
    if (resolveForm.resolved_by) body.resolved_by = Number(resolveForm.resolved_by);
    resolveMut.mutate({ id: resolveRow.id, body });
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : rows.length === 0
              ? <p className="p-6 text-sm text-muted-foreground">No anomaly flags found.</p>
              : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead><TableHead>Month</TableHead><TableHead>Role</TableHead>
                        <TableHead>Flag Type</TableHead><TableHead>Severity</TableHead><TableHead>Explanation</TableHead>
                        <TableHead>Detected</TableHead><TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const isResolved = row.resolvedAt !== null;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium text-sm">{row.client.name}</TableCell>
                            <TableCell className="text-sm">{row.month.split("T")[0].slice(0, 7)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.roleType ? row.roleType.replace(/_/g, " ") : "—"}</TableCell>
                            <TableCell className="text-xs">{row.flagType.replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-xs">{row.severity}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[240px]" title={row.explanation}>
                              {row.explanation.length > 80 ? row.explanation.slice(0, 80) + "…" : row.explanation}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.detectedAt.split("T")[0]}</TableCell>
                            <TableCell>
                              {isResolved
                                ? <StatusBadge status="Resolved" />
                                : <StatusBadge status="open" />}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isResolved && (
                                <Button
                                  size="sm" variant="outline"
                                  className="text-xs border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-bg)]"
                                  onClick={() => openResolve(row)}
                                >
                                  Resolve
                                </Button>
                              )}
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

      <Dialog open={resolveRow !== null} onOpenChange={(v) => { if (!v) closeResolve(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Anomaly Flag</DialogTitle></DialogHeader>
          {resolveError && <p className="text-sm text-destructive">{resolveError}</p>}
          <form onSubmit={handleResolve} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resolved By (Person ID)</Label>
              <Input
                type="number" min="1"
                value={resolveForm.resolved_by}
                onChange={e => setResolveForm({ ...resolveForm, resolved_by: e.target.value })}
                placeholder="Optional — person ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Resolution Notes *</Label>
              <Textarea
                required
                value={resolveForm.resolution_notes}
                onChange={e => setResolveForm({ ...resolveForm, resolution_notes: e.target.value })}
                placeholder="Describe how this was resolved…"
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeResolve}>Cancel</Button>
              <Button type="submit" disabled={resolveMut.isPending} className="bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90">
                {resolveMut.isPending ? "Resolving…" : "Confirm Resolve"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

interface SuggestionRow {
  id: number; month: string; suggestionType: string; status: string;
  explanation: string; suggestedAction: string | null;
  person: { id: number; name: string } | null;
  squad: { id: number; name: string };
}

function SuggestionsSection() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-suggestions"],
    queryFn: () => api.get<SuggestionRow[]>("/management/analytics/suggestions").then(r => r.data),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/management/analytics/suggestions/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mgmt-suggestions"] }); },
  });

  const TERMINAL = ["applied", "dismissed"];

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading
          ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          : rows.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No suggestions found.</p>
            : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead><TableHead>Squad</TableHead><TableHead>Month</TableHead>
                      <TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Explanation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const isTerminal = TERMINAL.includes(row.status);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm">{row.person?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.squad.name}</TableCell>
                          <TableCell className="text-sm">{row.month.split("T")[0].slice(0, 7)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.suggestionType.replace(/_/g, " ")}</TableCell>
                          <TableCell><StatusBadge status={row.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[240px]" title={row.explanation}>
                            {row.explanation.length > 80 ? row.explanation.slice(0, 80) + "…" : row.explanation}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isTerminal && (
                              <div className="flex gap-1.5 justify-end flex-wrap">
                                {row.status === "open" && (
                                  <Button size="sm" variant="outline" disabled={statusMut.isPending}
                                    className="text-xs border-[var(--watch)] text-[var(--watch)] hover:bg-[var(--watch-bg)]"
                                    onClick={() => statusMut.mutate({ id: row.id, status: "acknowledged" })}>
                                    Acknowledge
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" disabled={statusMut.isPending}
                                  className="text-xs border-[var(--safe)] text-[var(--safe)] hover:bg-[var(--safe-bg)]"
                                  onClick={() => statusMut.mutate({ id: row.id, status: "applied" })}>
                                  Apply
                                </Button>
                                <Button size="sm" variant="outline" disabled={statusMut.isPending}
                                  className="text-xs text-muted-foreground"
                                  onClick={() => statusMut.mutate({ id: row.id, status: "dismissed" })}>
                                  Dismiss
                                </Button>
                              </div>
                            )}
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
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AnalyticsTab() {
  return (
    <Tabs defaultValue="anomalies">
      <TabsList className="mb-5">
        <TabsTrigger value="anomalies">Anomaly Flags</TabsTrigger>
        <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
      </TabsList>
      <TabsContent value="anomalies"><AnomalyFlagsSection /></TabsContent>
      <TabsContent value="suggestions"><SuggestionsSection /></TabsContent>
    </Tabs>
  );
}
