import { NextRequest, NextResponse } from "next/server";
import { nonBillableService } from "@/lib/db";

export async function GET() {
  const categories = await nonBillableService.listNonBillableCategories();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    type: string;
    description?: string;
  };

  const category = await nonBillableService.createNonBillableCategory({
    name: body.name,
    type: body.type as never,
    description: body.description ?? null,
  });
  return NextResponse.json(category, { status: 201 });
}
