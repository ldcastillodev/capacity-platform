import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const today = new Date();
  const [persons, memberships, squads, clients, contracts, sows] = await Promise.all([
    prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.squadMembership.findMany({
      where: {
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      select: { personId: true, squadId: true },
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

  const squadIdsByPerson = new Map<number, number[]>();
  for (const m of memberships) {
    const list = squadIdsByPerson.get(m.personId);
    if (list) list.push(m.squadId);
    else squadIdsByPerson.set(m.personId, [m.squadId]);
  }
  const personsWithSquads = persons.map((p) => ({
    ...p,
    squadIds: squadIdsByPerson.get(p.id) ?? [],
  }));

  return NextResponse.json({ persons: personsWithSquads, squads, clients, contracts, sows });
}
