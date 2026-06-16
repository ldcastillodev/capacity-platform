import { NextRequest, NextResponse } from "next/server";
import { clientService, hourRecordService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const body = (await req.json()) as { name?: string; region?: string; currency?: string };

  // Guard: block currency change if hour records already exist
  if (body.currency !== undefined) {
    const hourCount = await hourRecordService.countHoursByClient(clientId);
    if (hourCount > 0) {
      return NextResponse.json(
        { error: "Cannot change currency after billing records exist." },
        { status: 400 }
      );
    }
  }

  const client = await clientService.updateClient(clientId, {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.region !== undefined && { region: body.region as never }),
    ...(body.currency !== undefined && { currency: body.currency as never }),
  });
  return NextResponse.json(client);
}
