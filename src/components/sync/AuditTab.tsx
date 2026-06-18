"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

function fmt(v: string | null | undefined) {
  return v ? v.split("T")[0] : "—";
}
function nullDash(v: unknown) {
  return v == null ? "—" : String(v);
}

function Pager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages < 1) return null;
  return (
    <Pagination className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(page - 1)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="text-sm text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(page + 1)}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

interface SyncLogRow {
  id: number;
  source: string;
  startedAt: string;
  completedAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  recordsFetched: number | null;
  recordsCreated: number | null;
  recordsSkipped: number | null;
  recordsConflicted: number | null;
}

type SyncLogCol =
  | "source"
  | "started"
  | "completed"
  | "fetched"
  | "created"
  | "skipped"
  | "conflicted";
const SYNC_LOG_ACCESSORS: Record<
  SyncLogCol,
  (r: SyncLogRow) => string | number | null | undefined
> = {
  source: (r) => r.source,
  started: (r) => r.startedAt,
  completed: (r) => r.completedAt,
  fetched: (r) => r.recordsFetched,
  created: (r) => r.recordsCreated,
  skipped: (r) => r.recordsSkipped,
  conflicted: (r) => r.recordsConflicted,
};

function SyncLogsSection() {
  const [page, setPage] = useState(1);
  const sort = useSortState<SyncLogCol>();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sync-logs"],
    queryFn: () => api.get<SyncLogRow[]>("/management/sync-logs").then((r) => r.data),
  });

  const sorted = useMemo(
    () => (sort.sortKey ? sortRows(rows, SYNC_LOG_ACCESSORS[sort.sortKey], sort.sortDir) : rows),
    [rows, sort.sortKey, sort.sortDir]
  );
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Sync logs</h3>
        <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
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
            <p className="p-6 text-muted-foreground text-sm">No records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead colKey="source" sort={sort}>
                      Source
                    </SortableHead>
                    <SortableHead colKey="started" sort={sort}>
                      Started
                    </SortableHead>
                    <SortableHead colKey="completed" sort={sort}>
                      Completed
                    </SortableHead>
                    <SortableHead colKey="fetched" sort={sort} align="right" className="text-right">
                      Fetched
                    </SortableHead>
                    <SortableHead colKey="created" sort={sort} align="right" className="text-right">
                      Created
                    </SortableHead>
                    <SortableHead colKey="skipped" sort={sort} align="right" className="text-right">
                      Skipped
                    </SortableHead>
                    <SortableHead
                      colKey="conflicted"
                      sort={sort}
                      align="right"
                      className="text-right"
                    >
                      Conflicted
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(row.startedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(row.completedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {nullDash(row.recordsFetched)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {nullDash(row.recordsCreated)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {nullDash(row.recordsSkipped)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {nullDash(row.recordsConflicted)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CONFLICT_CATEGORIES = [
  "missing_mapping",
  "missing_membership",
  "missing_role",
  "missing_declaration",
  "inactive_target",
] as const;

interface SyncConflictRow {
  id: number;
  source: string;
  externalRef: string;
  category: string;
  authorEmail: string | null;
  issueKey: string | null;
  componentKey: string | null;
  date: string;
  hours: string;
  detail: string | null;
  lastSeenAt: string;
}

type SyncConflictCol =
  | "category"
  | "person"
  | "issue"
  | "component"
  | "date"
  | "hours"
  | "detail"
  | "lastSeen";
const SYNC_CONFLICT_ACCESSORS: Record<
  SyncConflictCol,
  (r: SyncConflictRow) => string | number | null | undefined
> = {
  category: (r) => r.category,
  person: (r) => r.authorEmail,
  issue: (r) => r.issueKey,
  component: (r) => r.componentKey,
  date: (r) => r.date,
  hours: (r) => Number(r.hours),
  detail: (r) => r.detail,
  lastSeen: (r) => r.lastSeenAt,
};

function SyncConflictsSection() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const sort = useSortState<SyncConflictCol>();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-sync-conflicts", category, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (category !== "all") params.category = category;
      if (search.trim()) params.search = search.trim();
      return api
        .get<SyncConflictRow[]>("/management/sync-conflicts", { params })
        .then((r) => r.data);
    },
  });

  const sorted = useMemo(
    () =>
      sort.sortKey ? sortRows(rows, SYNC_CONFLICT_ACCESSORS[sort.sortKey], sort.sortDir) : rows,
    [rows, sort.sortKey, sort.sortDir]
  );
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Sync conflicts</h3>
        <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CONFLICT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Search</Label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Person, issue, or component"
            className="w-72"
          />
        </div>
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
            <p className="p-6 text-muted-foreground text-sm">No records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead colKey="category" sort={sort}>
                      Category
                    </SortableHead>
                    <SortableHead colKey="person" sort={sort}>
                      Person
                    </SortableHead>
                    <SortableHead colKey="issue" sort={sort}>
                      Issue
                    </SortableHead>
                    <SortableHead colKey="component" sort={sort}>
                      Component
                    </SortableHead>
                    <SortableHead colKey="date" sort={sort}>
                      Date
                    </SortableHead>
                    <SortableHead colKey="hours" sort={sort} align="right" className="text-right">
                      Hours
                    </SortableHead>
                    <SortableHead colKey="detail" sort={sort}>
                      Detail
                    </SortableHead>
                    <SortableHead colKey="lastSeen" sort={sort}>
                      Last seen
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">
                        {row.category.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-sm">{nullDash(row.authorEmail)}</TableCell>
                      <TableCell className="text-sm">{nullDash(row.issueKey)}</TableCell>
                      <TableCell className="text-sm">{nullDash(row.componentKey)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(row.date)}
                      </TableCell>
                      <TableCell className="text-sm text-right">{row.hours}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md">
                        {nullDash(row.detail)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(row.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditTab() {
  return (
    <div className="space-y-8">
      <SyncLogsSection />
      <SyncConflictsSection />
    </div>
  );
}
