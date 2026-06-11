import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const mapping = await prisma.jiraComponentClientMapping.update({
      where: { id: Number(id) },
      data: { effectiveTo: null },
      select: { id: true, componentKey: true, effectiveTo: true },
    });
    return NextResponse.json(mapping);
  } catch (e) {
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json(
        { error: "Cannot unarchive: a newer mapping for this component overlaps the reopened range." },
        { status: 409 },
      );
    throw e;
  }
}
