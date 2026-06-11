import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findEffective, toUtcDateOnly } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const personId = searchParams.get("person_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const records = await prisma.hourRecord.findMany({
    where: {
      ...(clientId ? { clientId: Number(clientId) } : {}),
      ...(personId ? { personId: Number(personId) } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: 500,
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    person_id: number;
    client_id: number;
    date: string;
    hours: number;
  };

  // squadId and roleType are resolved server-side from the date-effective
  // membership/role rows — never trusted from the request body.
  const date = toUtcDateOnly(body.date);
  const [memberships, roles] = await Promise.all([
    prisma.squadMembership.findMany({
      where: { personId: body.person_id },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.personRole.findMany({
      where: { personId: body.person_id },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const membership = findEffective(memberships, date);
  if (!membership) {
    return NextResponse.json(
      { error: `No active squad membership for person ${body.person_id} on ${body.date}` },
      { status: 422 },
    );
  }
  const role = findEffective(roles, date);
  if (!role) {
    return NextResponse.json(
      { error: `No active role for person ${body.person_id} on ${body.date}` },
      { status: 422 },
    );
  }

  const record = await prisma.hourRecord.create({
    data: {
      personId: body.person_id,
      clientId: body.client_id,
      squadId: membership.squadId,
      date,
      hours: body.hours,
      roleType: role.roleType,
      source: "manual",
    },
  });
  return NextResponse.json(record, { status: 201 });
}
