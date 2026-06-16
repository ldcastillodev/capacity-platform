import prisma from "@/lib/prisma";
import { NbMappingSource, Prisma } from "@prisma/client";
import type { Db } from "../types";

/** NonBillableCategory + NonBillableSourceMapping queries. */

// ─── Categories ──────────────────────────────────────────────────────────────

const categoryWithCountArgs = {
  select: {
    id: true,
    name: true,
    type: true,
    description: true,
    isActive: true,
    _count: { select: { hourRecords: true, sourceMappings: true } },
  },
} satisfies Prisma.NonBillableCategoryDefaultArgs;
/** A category with usage counts (management shape). */
export type CategoryWithCount = Prisma.NonBillableCategoryGetPayload<typeof categoryWithCountArgs>;

/** List all non-billable categories (full rows), alphabetical. Empty → []. */
export function listNonBillableCategories(db: Db = prisma) {
  return db.nonBillableCategory.findMany({ orderBy: { name: "asc" } });
}

/** Create a non-billable category (returns the full record). */
export function createNonBillableCategory(
  data: Prisma.NonBillableCategoryUncheckedCreateInput,
  db: Db = prisma
) {
  return db.nonBillableCategory.create({ data });
}

/**
 * List managed categories (with usage counts). Inactive excluded unless
 * `includeArchived`. Empty → [].
 */
export function listManagedNonBillableCategories(
  filters: { includeArchived?: boolean },
  db: Db = prisma
): Promise<CategoryWithCount[]> {
  return db.nonBillableCategory.findMany({
    where: filters.includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    ...categoryWithCountArgs,
  });
}

/** Create a category, returning the usage-count shape. */
export function createManagedNonBillableCategory(
  data: Prisma.NonBillableCategoryUncheckedCreateInput,
  db: Db = prisma
): Promise<CategoryWithCount> {
  return db.nonBillableCategory.create({ data, ...categoryWithCountArgs });
}

/** Update a category, returning id/name/type/description/isActive. */
export function updateNonBillableCategory(
  id: number,
  data: Prisma.NonBillableCategoryUncheckedUpdateInput,
  db: Db = prisma
) {
  return db.nonBillableCategory.update({
    where: { id },
    data,
    select: { id: true, name: true, type: true, description: true, isActive: true },
  });
}

/** Archive a category (isActive → false). Returns id/name/type/isActive. */
export function archiveNonBillableCategory(id: number, db: Db = prisma) {
  return db.nonBillableCategory.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true, type: true, isActive: true },
  });
}

/** List categories by id (full rows) for metadata lookup. Empty → []. */
export function listNonBillableCategoriesByIds(ids: number[], db: Db = prisma) {
  return db.nonBillableCategory.findMany({ where: { id: { in: ids } } });
}

// ─── Source Mappings ─────────────────────────────────────────────────────────

const sourceMappingWithCategoryArgs = {
  select: {
    id: true,
    source: true,
    identifierType: true,
    identifierValue: true,
    categoryId: true,
    category: { select: { id: true, name: true } },
  },
} satisfies Prisma.NonBillableSourceMappingDefaultArgs;
/** A source mapping with its category summary. */
export type SourceMappingWithCategory = Prisma.NonBillableSourceMappingGetPayload<
  typeof sourceMappingWithCategoryArgs
>;

/**
 * List source mappings (with category), optionally scoped to one category.
 * Ordered by identifier value. Empty → [].
 */
export function listSourceMappings(
  filters: { categoryId?: number },
  db: Db = prisma
): Promise<SourceMappingWithCategory[]> {
  return db.nonBillableSourceMapping.findMany({
    where: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
    orderBy: { identifierValue: "asc" },
    ...sourceMappingWithCategoryArgs,
  });
}

/** Create a source mapping, returning the category summary shape. */
export function createSourceMapping(
  data: Prisma.NonBillableSourceMappingUncheckedCreateInput,
  db: Db = prisma
): Promise<SourceMappingWithCategory> {
  return db.nonBillableSourceMapping.create({ data, ...sourceMappingWithCategoryArgs });
}

/** Hard-delete a source mapping (mappings carry no historical attribution). */
export function deleteSourceMapping(id: number, db: Db = prisma) {
  return db.nonBillableSourceMapping.delete({ where: { id } });
}

/** List Jira NA source mappings (full rows) for the sync. Empty → []. */
export function listSourceMappingsForSync(db: Db = prisma) {
  return db.nonBillableSourceMapping.findMany({ where: { source: NbMappingSource.jira_na } });
}
