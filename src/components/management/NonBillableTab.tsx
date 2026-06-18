"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { SortableHead } from "@/components/app/SortableHead";
import { useSortState, sortRows } from "@/hooks/useTableSort";
import { ManagementModal } from "./ManagementModal";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { JIRA_INSTANCES } from "@/lib/constants";

function errMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(e);
}

const NB_TYPES = ["shared_ceremony", "leave", "internal_meeting", "training", "company"];

interface NbCategoryRow {
  id: number;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  _count: { entries: number; sourceMappings: number };
}
interface SourceMappingRow {
  id: number;
  categoryId: number;
  source: string;
  identifierType: string;
  identifierValue: string;
  category: { id: number; name: string };
}

type CategoryCol = "name" | "type" | "description" | "entries" | "mappings" | "status";
const CATEGORY_ACCESSORS: Record<CategoryCol, (r: NbCategoryRow) => string | number | null> = {
  name: (r) => r.name,
  type: (r) => r.type,
  description: (r) => r.description,
  entries: (r) => r._count.entries,
  mappings: (r) => r._count.sourceMappings,
  status: (r) => (r.isActive ? "Active" : "Archived"),
};

function CategoriesSection() {
  const qc = useQueryClient();
  const sort = useSortState<CategoryCol>();
  const [showArchived, setShowArchived] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<NbCategoryRow | null>(null);
  const [form, setForm] = useState({ name: "", type: "internal_ceremony", description: "" });
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-categories", showArchived],
    queryFn: () =>
      api
        .get<NbCategoryRow[]>(`/management/nonbillable-categories?includeArchived=${showArchived}`)
        .then((r) => r.data),
  });
  const visibleRows = showArchived ? rows.filter((r) => !r.isActive) : rows;
  const sortedRows = useMemo(
    () =>
      sort.sortKey
        ? sortRows(visibleRows, CATEGORY_ACCESSORS[sort.sortKey], sort.sortDir)
        : visibleRows,
    [visibleRows, sort.sortKey, sort.sortDir]
  );

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api
        .post("/management/nonbillable-categories", {
          name: f.name,
          type: f.type,
          description: f.description || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: typeof form }) =>
      api
        .patch(`/management/nonbillable-categories/${id}`, {
          name: f.name,
          type: f.type,
          description: f.description || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/management/nonbillable-categories/${id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-nb-categories"] });
      setArchiveId(null);
    },
  });

  function openCreate() {
    setForm({ name: "", type: "internal_ceremony", description: "" });
    setEditing(null);
    setApiError(null);
    setModalMode("create");
  }
  function openEdit(row: NbCategoryRow) {
    setForm({ name: row.name, type: row.type, description: row.description ?? "" });
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
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
        <Button size="sm" onClick={openCreate}>
          + Add Category
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
          ) : visibleRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No categories found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead colKey="name" sort={sort}>
                      Name
                    </SortableHead>
                    <SortableHead colKey="type" sort={sort}>
                      Type
                    </SortableHead>
                    <SortableHead colKey="description" sort={sort}>
                      Description
                    </SortableHead>
                    <SortableHead colKey="entries" sort={sort} align="right" className="text-right">
                      Entries
                    </SortableHead>
                    <SortableHead
                      colKey="mappings"
                      sort={sort}
                      align="right"
                      className="text-right"
                    >
                      Mappings
                    </SortableHead>
                    <SortableHead
                      colKey="status"
                      sort={sort}
                      align="center"
                      className="text-center"
                    >
                      Status
                    </SortableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell className="text-sm">{row.type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right">{row._count.entries}</TableCell>
                      <TableCell className="text-sm text-right">
                        {row._count.sourceMappings}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            row.isActive
                              ? "bg-[var(--safe-bg)] text-[var(--safe)] border-0"
                              : "bg-muted text-muted-foreground border-0"
                          }
                        >
                          {row.isActive ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isActive && (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => setArchiveId(row.id)}
                            >
                              Archive
                            </Button>
                          </div>
                        )}
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
        title={modalMode === "create" ? "Add Category" : `Edit Category — ${editing?.name}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Category name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NB_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
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

      <ConfirmDialog
        open={archiveId !== null}
        onOpenChange={(v) => {
          if (!v) setArchiveId(null);
        }}
        title="Archive category?"
        description="This will hide it from future entries."
        confirmLabel="Archive"
        destructive
        onConfirm={() => archiveId !== null && archiveMutation.mutate(archiveId)}
      />
    </div>
  );
}

type MappingCol = "category" | "source" | "identifier";
const MAPPING_ACCESSORS: Record<MappingCol, (r: SourceMappingRow) => string | number> = {
  category: (r) => r.category.name,
  source: (r) => `${r.source} / ${r.identifierType}`,
  identifier: (r) => r.identifierValue,
};

function SourceMappingsSection() {
  const qc = useQueryClient();
  const sort = useSortState<MappingCol>();
  const [modalMode, setModalMode] = useState<"create" | null>(null);
  const [form, setForm] = useState({
    category_id: "",
    source: "",
    identifier_type: "",
    identifier_value: "",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mgmt-nb-source-mappings"],
    queryFn: () =>
      api.get<SourceMappingRow[]>("/management/nonbillable-source-mappings").then((r) => r.data),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["mgmt-nb-categories"],
    queryFn: () =>
      api.get<NbCategoryRow[]>("/management/nonbillable-categories").then((r) => r.data),
  });
  const sortedRows = useMemo(
    () => (sort.sortKey ? sortRows(rows, MAPPING_ACCESSORS[sort.sortKey], sort.sortDir) : rows),
    [rows, sort.sortKey, sort.sortDir]
  );

  const createMutation = useMutation({
    mutationFn: (f: typeof form) =>
      api
        .post("/management/nonbillable-source-mappings", {
          category_id: Number(f.category_id),
          source: f.source,
          identifier_type: f.identifier_type,
          identifier_value: f.identifier_value,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-nb-source-mappings"] });
      closeModal();
    },
    onError: (e: unknown) => setApiError(errMsg(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/management/nonbillable-source-mappings/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mgmt-nb-source-mappings"] });
      setDeleteId(null);
    },
  });

  function openCreate() {
    setForm({ category_id: "", source: "", identifier_type: "", identifier_value: "" });
    setApiError(null);
    setModalMode("create");
  }
  function closeModal() {
    setModalMode(null);
    setApiError(null);
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          + Add Mapping
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
            <p className="p-6 text-sm text-muted-foreground">No source mappings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead colKey="category" sort={sort}>
                      Category
                    </SortableHead>
                    <SortableHead colKey="source" sort={sort}>
                      Source / Type
                    </SortableHead>
                    <SortableHead colKey="identifier" sort={sort}>
                      Identifier Value
                    </SortableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.category.name}</TableCell>
                      <TableCell className="text-sm">
                        {row.source} / {row.identifierType}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.identifierValue}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(row.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManagementModal isOpen={modalMode !== null} onClose={closeModal} title="Add Source Mapping">
        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select
              required
              value={form.category_id || "none"}
              onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select category —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select category —</SelectItem>
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source *</Label>
            <Select
              required
              value={form.source || "none"}
              onValueChange={(v) => setForm({ ...form, source: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select source —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select source —</SelectItem>
                {JIRA_INSTANCES.map((j) => (
                  <SelectItem key={j.source} value={j.source}>
                    {`Jira ${j.label}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Identifier Type *</Label>
            <Select
              required
              value={form.identifier_type || "none"}
              onValueChange={(v) => setForm({ ...form, identifier_type: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Select type —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select type —</SelectItem>
                <SelectItem value="issue_key">Issue Key (ex: MP-XXXX)</SelectItem>
                <SelectItem value="account_key">Account Key</SelectItem>
                <SelectItem value="component_key">Component Key</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Identifier Value *</Label>
            <Input
              required
              value={form.identifier_value}
              onChange={(e) => setForm({ ...form, identifier_value: e.target.value })}
              placeholder="e.g. CAAS-001"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Create"}
            </Button>
          </div>
        </form>
      </ManagementModal>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
        title="Delete mapping?"
        description="This action is permanent and cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

export function NonBillableTab() {
  return (
    <Tabs defaultValue="categories">
      <TabsList className="mb-5">
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="mappings">Source Mappings</TabsTrigger>
      </TabsList>
      <TabsContent value="categories">
        <CategoriesSection />
      </TabsContent>
      <TabsContent value="mappings">
        <SourceMappingsSection />
      </TabsContent>
    </Tabs>
  );
}
