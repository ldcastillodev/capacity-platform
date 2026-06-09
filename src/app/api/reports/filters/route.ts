import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const [persons, squads, clients, contracts, sows] = await Promise.all([
    prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.squad.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contract.findMany({
      select: { id: true, name: true, sowId: true },
      orderBy: { name: "asc" },
    }),
    prisma.statementOfWork.findMany({
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ persons, squads, clients, contracts, sows });
}
