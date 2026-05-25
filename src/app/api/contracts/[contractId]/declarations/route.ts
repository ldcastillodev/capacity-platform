import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const decls = await prisma.monthlyRoleDeclaration.findMany({
    where: {
      contractId: Number(contractId),
      ...(month ? { month: new Date(month) } : {}),
    },
    orderBy: [{ month: "desc" }, { roleType: "asc" }],
  });
  return NextResponse.json(decls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params;
  const body = await req.json() as Array<{
    role_type: string;
    declared_hours: number;
    month: string;
    squad_id: number;
  }>;

  const contract = await prisma.retainerContract.findUnique({
    where: { id: Number(contractId) },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const monthDate = new Date(body[0].month);
  const totalDeclared = body.reduce((s, r) => s + r.declared_hours, 0);
  const poolHours = parseFloat(String(contract.totalPoolHours));

  if (totalDeclared > poolHours) {
    return NextResponse.json(
      { error: `Total declared hours (${totalDeclared}) exceeds pool hours (${poolHours})` },
      { status: 422 },
    );
  }

  const decls = await Promise.all(
    body.map((row) =>
      prisma.monthlyRoleDeclaration.create({
        data: {
          contractId: Number(contractId),
          clientId: contract.clientId,
          squadId: row.squad_id,
          month: monthDate,
          roleType: row.role_type as never,
          declaredHours: row.declared_hours,
          status: "draft",
          submittedAt: new Date(),
        },
      }),
    ),
  );
  return NextResponse.json(decls, { status: 201 });
}
