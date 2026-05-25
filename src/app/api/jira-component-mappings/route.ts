import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const mappings = await prisma.jiraComponentClientMapping.findMany({
    include: { client: true },
    orderBy: { componentKey: "asc" },
  });
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    component_key: string;
    client_id: number;
    jira_instance?: string;
    effective_from?: string;
  };

  const mapping = await prisma.jiraComponentClientMapping.create({
    data: {
      componentKey: body.component_key,
      clientId: body.client_id,
      jiraInstance: body.jira_instance ?? "na",
      effectiveFrom: body.effective_from ? new Date(body.effective_from) : new Date(),
    },
    include: { client: true },
  });
  return NextResponse.json(mapping, { status: 201 });
}
