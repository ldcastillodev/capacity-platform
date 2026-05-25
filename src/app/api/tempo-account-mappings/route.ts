import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const mappings = await prisma.tempoAccountClientMapping.findMany({
    include: { client: true },
    orderBy: { accountKey: "asc" },
  });
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    account_key: string;
    client_id: number;
    effective_from?: string;
  };

  const mapping = await prisma.tempoAccountClientMapping.create({
    data: {
      accountKey: body.account_key,
      clientId: body.client_id,
      effectiveFrom: body.effective_from ? new Date(body.effective_from) : new Date(),
    },
    include: { client: true },
  });
  return NextResponse.json(mapping, { status: 201 });
}
