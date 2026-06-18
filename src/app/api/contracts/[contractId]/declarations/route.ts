import { NextRequest, NextResponse } from "next/server";
import { contractService, declarationService } from "@/lib/db";
import type { RoleType } from "@prisma/client";
import { parseHours } from "@/lib/utils/formatting";

const VALID_ROLE_TYPES = new Set([
  "dev",
  "devops",
  "qa",
  "design",
  "product",
  "project",
  "tl",
  "sre",
  "data",
  "seo",
  "content",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const decls = await declarationService.listDeclarationsByContract(
    Number(contractId),
    month ? new Date(month) : null
  );
  return NextResponse.json(decls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const force = new URL(req.url).searchParams.get("force") === "true";
  const body = (await req.json()) as Array<{
    role_type: string;
    declared_hours: number;
    month: string;
    squad_id: number;
  }>;

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "roles must be a non-empty array" }, { status: 400 });
  }
  for (const row of body) {
    if (!VALID_ROLE_TYPES.has(row.role_type)) {
      return NextResponse.json({ error: `Invalid role_type: ${row.role_type}` }, { status: 400 });
    }
    if (typeof row.declared_hours !== "number" || row.declared_hours <= 0) {
      return NextResponse.json(
        {
          error: `declared_hours must be a positive number (got ${row.declared_hours} for ${row.role_type})`,
        },
        { status: 400 }
      );
    }
  }
  const roleTypes = body.map((r) => r.role_type);
  const dupes = roleTypes.filter((r, i) => roleTypes.indexOf(r) !== i);
  if (dupes.length > 0) {
    return NextResponse.json(
      { error: `Duplicate role_type: ${[...new Set(dupes)].join(", ")}` },
      { status: 400 }
    );
  }

  const contract = await contractService.findContractWithClientId(Number(contractId));
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const monthDate = new Date(body[0].month);
  const squadId = body[0].squad_id;

  const existing = await declarationService.findDeclarationByContractMonth(
    Number(contractId),
    monthDate
  );
  if (existing) {
    return NextResponse.json(
      { error: "Declaration already exists for this contract and month" },
      { status: 409 }
    );
  }

  const totalDeclared = body.reduce((s, r) => s + r.declared_hours, 0);
  const assignedHours = parseHours(contract.assignedHours);
  if (totalDeclared > assignedHours && !force) {
    return NextResponse.json(
      {
        error: `Total declared hours (${totalDeclared}) exceed contracted hours (${assignedHours}).`,
        code: "HOURS_EXCEED",
        total_declared: totalDeclared,
        assigned_hours: assignedHours,
      },
      { status: 422 }
    );
  }

  const decl = await declarationService.createDeclarationWithRoles({
    contractId: Number(contractId),
    clientId: contract.sow.clientId,
    squadId,
    month: monthDate,
    status: "draft",
    roles: {
      create: body.map((r) => ({
        roleType: r.role_type as RoleType,
        declaredHours: r.declared_hours,
      })),
    },
  });
  return NextResponse.json(decl, { status: 201 });
}
