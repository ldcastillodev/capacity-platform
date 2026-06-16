import { NextRequest, NextResponse } from "next/server";
import { clientService, anomalyService, personService, squadService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  const today = new Date();
  const monthDate = monthParam
    ? new Date(monthParam)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const [totalClients, openFlags, personsCount, squadsCount] = await Promise.all([
    clientService.countActiveClients(),
    anomalyService.countOpenAnomalyFlags(monthDate),
    personService.countActivePersons(),
    squadService.countActiveSquads(),
  ]);

  return NextResponse.json({
    month: monthDate.toISOString().slice(0, 10),
    total_active_clients: totalClients,
    open_anomaly_flags: openFlags,
    persons_count: personsCount,
    squads_count: squadsCount,
  });
}
