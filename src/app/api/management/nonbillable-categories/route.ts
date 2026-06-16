import { NextRequest, NextResponse } from "next/server";
import { nonBillableService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  try {
    const rows = await nonBillableService.listManagedNonBillableCategories({ includeArchived });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name: string; type: string; description?: string };
    const row = await nonBillableService.createManagedNonBillableCategory({
      name: body.name,
      type: body.type as never,
      description: body.description ?? null,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Category name must be unique." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
