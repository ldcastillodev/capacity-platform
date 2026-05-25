import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: true, currency: true, isActive: true },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    region: string;
    currency?: string;
  };

  const client = await prisma.client.create({
    data: {
      name: body.name,
      region: body.region as never,
      currency: (body.currency as never) ?? "USD",
    },
    select: { id: true, name: true, region: true, currency: true, isActive: true },
  });
  return NextResponse.json(client, { status: 201 });
}
