import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const clientId = searchParams.get("client_id");

  if (!month) {
    return NextResponse.json({ error: "month required" }, { status: 400 });
  }

  const monthDate = new Date(month);

  // Sum approved T&E declarations per squad for the given month.
  // T&E declarations are MonthlyRoleDeclaration rows with extensionId != null.
  const grouped = await prisma.monthlyRoleDeclaration.groupBy({
    by: ["squadId"],
    where: {
      extensionId: { not: null },
      month: monthDate,
      ...(clientId
        ? { extension: { is: { contract: { is: { clientId: Number(clientId) } } } } }
        : {}),
    },
    _sum: { declaredHours: true },
  });

  const result = grouped
    .filter((g) => g.squadId !== null)
    .map((g) => ({
      squad_id: g.squadId as number,
      te_hours: Number(g._sum.declaredHours ?? 0),
    }));

  return NextResponse.json(result);
}
