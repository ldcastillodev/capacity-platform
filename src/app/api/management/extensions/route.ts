import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId");

  const extensions = await prisma.extension.findMany({
    where: contractId ? { contractId: Number(contractId) } : undefined,
    orderBy: { targetMonth: "asc" },
    select: {
      id: true,
      contractId: true,
      hours: true,
      reason: true,
      targetMonth: true,
      contract: {
        select: {
          id: true,
          name: true,
          sow: {
            select: {
              id: true,
              name: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(extensions);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    contract_id: number;
    hours: number;
    target_month: string;
    reason?: string;
  };

  try {
    const extension = await prisma.extension.create({
      data: {
        contractId: body.contract_id,
        hours: body.hours,
        targetMonth: new Date(body.target_month),
        reason: body.reason ?? null,
      },
      select: {
        id: true,
        contractId: true,
        hours: true,
        reason: true,
        targetMonth: true,
        contract: {
          select: {
            id: true,
            name: true,
            sow: {
              select: {
                id: true,
                name: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    return NextResponse.json(extension, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "This contract already has an extension." },
        { status: 409 },
      );
    }
    throw e;
  }
}
