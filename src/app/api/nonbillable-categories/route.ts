import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.nonBillableCategory.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    type: string;
    description?: string;
  };

  const category = await prisma.nonBillableCategory.create({
    data: {
      name: body.name,
      type: body.type as never,
      description: body.description ?? null,
    },
  });
  return NextResponse.json(category, { status: 201 });
}
