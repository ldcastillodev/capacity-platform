import { NextRequest, NextResponse } from "next/server";
import { hourRecordService, clientService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const grouped = await hourRecordService.sumNonBillableHoursByClient(monthDate, monthEnd);

  if (grouped.length === 0) return NextResponse.json([]);

  const clients = await clientService.listClientsByIds(grouped.map((r) => r.clientId!));
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const rows = grouped.map((r) => ({
    client_id: r.clientId,
    client_name: clientMap[r.clientId!] ?? `Client ${r.clientId}`,
    total_hours: parseFloat(String(r._sum.hours ?? 0)),
  }));

  return NextResponse.json(rows);
}
