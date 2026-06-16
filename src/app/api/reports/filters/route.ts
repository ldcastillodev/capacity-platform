import { NextResponse } from "next/server";
import { personService, squadService, clientService, contractService } from "@/lib/db";

export async function GET() {
  const today = new Date();
  const [persons, memberships, squads, clients, contracts, sows] = await Promise.all([
    personService.listActivePersonOptions(),
    squadService.listActiveMembershipPairs(today),
    squadService.listActiveSquadOptions(),
    clientService.listActiveClientOptions(),
    contractService.listContractFilterOptions(),
    contractService.listStatementOfWorkFilterOptions(),
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
