import { NextRequest, NextResponse } from "next/server";
import { clientService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const clients = await clientService.listManagedClients({ includeArchived });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; region: string; currency?: string };

  const client = await clientService.createManagedClient({
    name: body.name,
    region: body.region as never,
    currency: (body.currency as never) ?? "USD",
  });
  return NextResponse.json(client, { status: 201 });
}
