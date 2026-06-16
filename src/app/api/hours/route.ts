import { NextRequest, NextResponse } from "next/server";
import { hourRecordService, squadService, personService } from "@/lib/db";
import { findEffective, toUtcDateOnly } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const personId = searchParams.get("person_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const records = await hourRecordService.listHourRecords({
    clientId: clientId ? Number(clientId) : undefined,
    personId: personId ? Number(personId) : undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    person_id: number;
    client_id: number;
    date: string;
    hours: number;
  };

  // squadId and roleType are resolved server-side from the date-effective
  // membership/role rows — never trusted from the request body.
  const date = toUtcDateOnly(body.date);
  const [memberships, roles] = await Promise.all([
    squadService.listSquadMemberships({ personId: body.person_id }),
    personService.listPersonRoles({ personId: body.person_id }),
  ]);

  const membership = findEffective(memberships, date);
  if (!membership) {
    return NextResponse.json(
      { error: `No active squad membership for person ${body.person_id} on ${body.date}` },
      { status: 422 }
    );
  }
  const role = findEffective(roles, date);
  if (!role) {
    return NextResponse.json(
      { error: `No active role for person ${body.person_id} on ${body.date}` },
      { status: 422 }
    );
  }

  const record = await hourRecordService.createHourRecord({
    personId: body.person_id,
    clientId: body.client_id,
    squadId: membership.squadId,
    date,
    hours: body.hours,
    roleType: role.roleType,
    source: "manual",
  });
  return NextResponse.json(record, { status: 201 });
}
