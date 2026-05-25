import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");

  const decls = await prisma.monthlyRoleDeclaration.findMany({
    where: {
      ...(month ? { month: new Date(month) } : {}),
      ...(squadId ? { squadId: Number(squadId) } : {}),
    },
    orderBy: [{ month: "desc" }, { clientId: "asc" }, { roleType: "asc" }],
  });
  return NextResponse.json(decls);
}
