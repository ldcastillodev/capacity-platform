import { NextRequest, NextResponse } from "next/server";
import { nonBillableService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  try {
    const rows = await nonBillableService.listSourceMappings({
      categoryId: categoryId ? Number(categoryId) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      source: string;
      identifier_type: string;
      identifier_value: string;
      category_id: number;
    };
    const row = await nonBillableService.createSourceMapping({
      source: body.source as never,
      identifierType: body.identifier_type as never,
      identifierValue: body.identifier_value,
      categoryId: body.category_id,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json(
        { error: "Mapping already exists for this source/identifier." },
        { status: 400 }
      );
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
