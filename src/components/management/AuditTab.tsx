"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(v: string | null | undefined) { return v ? v.split("T")[0] : "—"; }
function nullDash(v: unknown) { return v == null ? "—" : String(v); }

interface SyncLogRow {
  id: number; source: string; startedAt: string; completedAt: string | null;
  dateFrom: string | null; dateTo: string | null;
  recordsFetched: number | null; recordsCreated: number | null;
  recordsSkipped: number | null; recordsConflicted: number | null;
}

function SyncLogsSection() {
  const [filterInput, setFilterInput] = useState("");
  const [submitted, setSubmitted] = useState<{ source: string }>({ source: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sync-logs", submitted],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (submitted.source) params.source = submitted.source;
      return api.get<SyncLogRow[]>("/management/sync-logs", { params }).then(r => r.data);
    },
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => { e.preventDefault(); setSubmitted({ source: filterInput }); }}
        className="flex gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label>Source</Label>
          <Input
            type="text" value={filterInput}
            onChange={e => setFilterInput(e.target.value)}
            placeholder="e.g. jira"
            className="w-48"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {isLoading
            ? <div className="p-6 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : rows.length === 0
              ? <p className="p-6 text-muted-foreground text-sm">No records found.</p>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead className="text-right">Fetched</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead className="text-right">Conflicted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-sm">{row.source}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(row.startedAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(row.completedAt)}</TableCell>
                          <TableCell className="text-sm text-right">{nullDash(row.recordsFetched)}</TableCell>
                          <TableCell className="text-sm text-right">{nullDash(row.recordsCreated)}</TableCell>
                          <TableCell className="text-sm text-right">{nullDash(row.recordsSkipped)}</TableCell>
                          <TableCell className="text-sm text-right">{nullDash(row.recordsConflicted)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
          }
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditTab() {
  return <SyncLogsSection />;
}
