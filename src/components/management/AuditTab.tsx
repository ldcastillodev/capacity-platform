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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

const CONFLICT_CATEGORIES = [
  "missing_mapping", "missing_membership", "missing_role",
  "missing_declaration", "inactive_target",
] as const;

interface SyncConflictRow {
  id: number; source: string; externalRef: string; category: string;
  authorEmail: string | null; issueKey: string | null; componentKey: string | null;
  date: string; hours: string; detail: string | null; lastSeenAt: string;
}

function SyncConflictsSection() {
  const [category, setCategory] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sync-conflicts", category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (category !== "all") params.category = category;
      return api.get<SyncConflictRow[]>("/management/sync-conflicts", { params }).then(r => r.data);
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {CONFLICT_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                        <TableHead>Category</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Component</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-sm">{row.category.replace("_", " ")}</TableCell>
                          <TableCell className="text-sm">{nullDash(row.authorEmail)}</TableCell>
                          <TableCell className="text-sm">{nullDash(row.issueKey)}</TableCell>
                          <TableCell className="text-sm">{nullDash(row.componentKey)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(row.date)}</TableCell>
                          <TableCell className="text-sm text-right">{row.hours}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-md">{nullDash(row.detail)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(row.lastSeenAt)}</TableCell>
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
  return (
    <div className="space-y-8">
      <SyncLogsSection />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Sync conflicts</h3>
        <SyncConflictsSection />
      </div>
    </div>
  );
}
