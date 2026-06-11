import { NextResponse } from "next/server";
import { runExpirySweep } from "@/lib/lifecycle";

export async function POST() {
  const result = await runExpirySweep();
  return NextResponse.json({ ok: true, ...result });
}
