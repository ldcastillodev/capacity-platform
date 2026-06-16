import { NextRequest, NextResponse } from "next/server";
import { clientService } from "@/lib/db";

export async function GET() {
  const clients = await clientService.listClients();
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    region: string;
    currency?: string;
  };

  const client = await clientService.createClient({
    name: body.name,
    region: body.region as never,
    currency: (body.currency as never) ?? "USD",
  });
  return NextResponse.json(client, { status: 201 });
}
