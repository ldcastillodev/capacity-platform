"use client";

import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const STATUS_TONE: Record<string, string> = {
  active: "bg-[var(--safe-bg)] text-[var(--safe)]",
  open: "bg-[var(--watch-bg)] text-[var(--watch)]",
  acknowledged: "bg-[var(--warning-bg)] text-[var(--warning)]",
  dismissed: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_TONE[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Anomaly Flags ────────────────────────────────────────────────────────────

interface AnomalyRow {
  id: number;
  clientId: number;
  squadId: number | null;
  month: string;
  roleType: string | null;
  flagType: string;
  severity: string;
  explanation: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  client: { id: number; name: string };
  squad: { id: number; name: string } | null;
}

type AnomalyCol =
  | "client"
  | "squad"
  | "month"
  | "role"
  | "flagType"
  | "severity"
  | "explanation"
  | "detected"
  | "status";

function flagStatus(r: AnomalyRow): string {
  if (r.resolvedAt === null) return "open";
  return r.resolutionNotes === "Dismissed" ? "dismissed" : "acknowledged";
}

const ANOMALY_ACCESSORS: Record<AnomalyCol, (r: AnomalyRow) => string | number | null> = {
  client: (r) => r.client.name,
  squad: (r) => r.squad?.name ?? null,
  month: (r) => r.month,
  role: (r) => r.roleType,
  flagType: (r) => r.flagType,
  severity: (r) => r.severity,
  explanation: (r) => r.explanation,
  detected: (r) => r.detectedAt,
  status: (r) => flagStatus(r),
};

function AnomalyFlagsSection() {
  const qc = useQueryClient();
  const sort = useSortState<AnomalyCol>();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-anomaly-flags"],
    queryFn: () => api.get<AnomalyRow[]>("/management/analytics/anomaly-flags").then((r) => r.data),
  });
  const sortedRows = useMemo(
    () => (sort.sortKey ? sortRows(rows, ANOMALY_ACCESSORS[sort.sortKey], sort.sortDir) : rows),
    [rows, sort.sortKey, sort.sortDir]
  );

  const resolveMut = useMutation({
    mutationFn: ({ id, resolution_notes }: { id: number; resolution_notes: string }) =>
      api
        .post(`/management/analytics/anomaly-flags/${id}/resolve`, { resolution_notes })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mgmt-anomaly-flags"] }),
  });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No anomaly flags found.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead colKey="client" sort={sort}>
                    Client
                  </SortableHead>
                  <SortableHead colKey="squad" sort={sort}>
                    Squad
                  </SortableHead>
                  <SortableHead colKey="month" sort={sort}>
                    Month
                  </SortableHead>
                  <SortableHead colKey="role" sort={sort}>
                    Role
                  </SortableHead>
                  <SortableHead colKey="flagType" sort={sort}>
                    Flag Type
                  </SortableHead>
                  <SortableHead colKey="severity" sort={sort}>
                    Severity
                  </SortableHead>
                  <SortableHead colKey="explanation" sort={sort}>
                    Explanation
                  </SortableHead>
                  <SortableHead colKey="detected" sort={sort}>
                    Detected
                  </SortableHead>
                  <SortableHead colKey="status" sort={sort}>
                    Status
                  </SortableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => {
                  const isOpen = row.resolvedAt === null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.client.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.squad?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.month.split("T")[0].slice(0, 7)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.roleType ? row.roleType.replace(/_/g, " ") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.flagType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs">{row.severity}</TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[240px]"
                        title={row.explanation}
                      >
                        {row.explanation.length > 80
                          ? row.explanation.slice(0, 80) + "…"
                          : row.explanation}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.detectedAt.split("T")[0]}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={flagStatus(row)} />
                      </TableCell>
                      <TableCell className="text-right">
                        {isOpen && (
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolveMut.isPending}
                              className="text-xs border-[var(--watch)] text-[var(--watch)] hover:bg-[var(--watch-bg)]"
                              onClick={() =>
                                resolveMut.mutate({ id: row.id, resolution_notes: "Acknowledged" })
                              }
                            >
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resolveMut.isPending}
                              className="text-xs text-muted-foreground"
                              onClick={() =>
                                resolveMut.mutate({ id: row.id, resolution_notes: "Dismissed" })
                              }
                            >
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

interface SuggestionRow {
  id: number;
  month: string;
  suggestionType: string;
  status: string;
  detectedAt: string;
  explanation: string;
  suggestedAction: string | null;
  person: { id: number; name: string } | null;
  squad: { id: number; name: string };
}

type SuggestionCol = "person" | "squad" | "month" | "created" | "type" | "status" | "explanation";
const SUGGESTION_ACCESSORS: Record<SuggestionCol, (r: SuggestionRow) => string | number | null> = {
  person: (r) => r.person?.name ?? null,
  squad: (r) => r.squad.name,
  month: (r) => r.month,
  created: (r) => r.detectedAt,
  type: (r) => r.suggestionType,
  status: (r) => r.status,
  explanation: (r) => r.explanation,
};

function SuggestionsSection() {
  const qc = useQueryClient();
  const sort = useSortState<SuggestionCol>();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-suggestions"],
    queryFn: () =>
      api.get<SuggestionRow[]>("/management/analytics/suggestions").then((r) => r.data),
  });
  const sortedRows = useMemo(
    () => (sort.sortKey ? sortRows(rows, SUGGESTION_ACCESSORS[sort.sortKey], sort.sortDir) : rows),
    [rows, sort.sortKey, sort.sortDir]
  );

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/management/analytics/suggestions/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-suggestions"] });
    },
  });

  const TERMINAL = ["dismissed"];

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No suggestions found.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead colKey="person" sort={sort}>
                    Person
                  </SortableHead>
                  <SortableHead colKey="squad" sort={sort}>
                    Squad
                  </SortableHead>
                  <SortableHead colKey="month" sort={sort}>
                    Month
                  </SortableHead>
                  <SortableHead colKey="created" sort={sort}>
                    Created
                  </SortableHead>
                  <SortableHead colKey="type" sort={sort}>
                    Type
                  </SortableHead>
                  <SortableHead colKey="status" sort={sort}>
                    Status
                  </SortableHead>
                  <SortableHead colKey="explanation" sort={sort}>
                    Explanation
                  </SortableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => {
                  const isTerminal = TERMINAL.includes(row.status);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{row.person?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.squad?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.month.split("T")[0].slice(0, 7)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.detectedAt?.split("T")[0] ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.suggestionType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[240px]"
                        title={row.explanation}
                      >
                        {row.explanation.length > 80
                          ? row.explanation.slice(0, 80) + "…"
                          : row.explanation}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isTerminal && (
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            {row.status === "open" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={statusMut.isPending}
                                className="text-xs border-[var(--watch)] text-[var(--watch)] hover:bg-[var(--watch-bg)]"
                                onClick={() =>
                                  statusMut.mutate({ id: row.id, status: "acknowledged" })
                                }
                              >
                                Acknowledge
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={statusMut.isPending}
                              className="text-xs text-muted-foreground"
                              onClick={() => statusMut.mutate({ id: row.id, status: "dismissed" })}
                            >
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function FlagsSuggestions() {
  return (
    <Tabs defaultValue="anomalies">
      <TabsList className="mb-5">
        <TabsTrigger value="anomalies">Anomaly Flags</TabsTrigger>
        <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
      </TabsList>
      <TabsContent value="anomalies">
        <AnomalyFlagsSection />
      </TabsContent>
      <TabsContent value="suggestions">
        <SuggestionsSection />
      </TabsContent>
    </Tabs>
  );
}
