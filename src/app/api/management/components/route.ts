import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

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
      contractId: true,
      effectiveFrom: true,
      effectiveTo: true,
      contract: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    component_key: string;
    contract_id: number;
    jira_instance?: string;
    effective_from?: string;
  };

  const jiraInstance = body.jira_instance ?? "na";
  const effectiveFrom = toUtcDateOnly(body.effective_from ?? new Date());
  const priorEnd = addUtcDays(effectiveFrom, -1);

  try {
    // BR-2: a component maps to exactly one contract at a time — end-date the
    // prior open mapping in the same transaction.
    const mapping = await prisma.$transaction(async (tx) => {
      const openRows = await tx.jiraComponentClientMapping.findMany({
        where: { jiraInstance, componentKey: body.component_key, effectiveTo: null },
      });
      for (const prior of openRows) {
        if (prior.effectiveFrom >= effectiveFrom) {
          throw new ConflictError(
            `Component already has a mapping starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`,
          );
        }
        await tx.jiraComponentClientMapping.update({
          where: { id: prior.id },
          data: { effectiveTo: priorEnd },
        });
      }
      return tx.jiraComponentClientMapping.create({
        data: {
          componentKey: body.component_key,
          contractId: body.contract_id,
          jiraInstance,
          effectiveFrom,
        },
        select: {
          id: true,
          jiraInstance: true,
          componentKey: true,
          contractId: true,
          effectiveFrom: true,
          effectiveTo: true,
          contract: { select: { id: true, name: true } },
        },
      });
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json({ error: "Overlapping mapping for this component's date range." }, { status: 409 });
    throw e;
  }
}
