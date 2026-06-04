import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  try {
    const rows = await prisma.nonBillableCategory.findMany({
      where: includeArchived ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, type: true, description: true,
        isActive: true,
        _count: { select: { hourRecords: true, sourceMappings: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name: string; type: string; description?: string };
    const row = await prisma.nonBillableCategory.create({
      data: {
        name: body.name,
        type: body.type as never,
        description: body.description ?? null,
      },
      select: {
        id: true, name: true, type: true, description: true,
        isActive: true,
        _count: { select: { hourRecords: true, sourceMappings: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Category name must be unique." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
