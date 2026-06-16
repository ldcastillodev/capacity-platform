import { NextRequest, NextResponse } from "next/server";
import { clientService } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await clientService.setClientActive(Number(id), true);

  return NextResponse.json(client);
}
