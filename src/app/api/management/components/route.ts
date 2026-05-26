import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  const today = new Date();

  const mappings = await prisma.jiraComponentClientMapping.findMany({
    where: includeArchived
      ? undefined
      : { OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] },
    orderBy: { componentKey: "asc" },
    select: {
      id: true,
      jiraInstance: true,
      componentKey: true,
      clientId: true,
      effectiveFrom: true,
      effectiveTo: true,
      client: { select: { id: true, name: true } },
    },
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
    select: {
      id: true,
      jiraInstance: true,
      componentKey: true,
      clientId: true,
      effectiveFrom: true,
      effectiveTo: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(mapping, { status: 201 });
}
