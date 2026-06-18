import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "db-snapshot.json"), "utf-8"));

  // Normalize every ISO date/datetime string in the snapshot to the current
  // calendar year so the canned data always reseeds into "now" (e.g. 2026 -> 2027
  // next year) without editing the snapshot. Anchored to YYYY-MM-DD so decimal
  // strings ("40", "0.5") and other text are left alone.
  const YEAR = new Date().getFullYear();
  const normalizeYears = (v: any): any =>
    typeof v === "string"
      ? v.replace(/^(\d{4})(-\d{2}-\d{2}T?)/, `${YEAR}$2`)
      : Array.isArray(v)
        ? v.map(normalizeYears)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, val]) => [k, normalizeYears(val)]))
          : v;
  const snapshot = normalizeYears(raw);

  // Clear in reverse FK order
  await prisma.anomalyFlag.deleteMany();
  await prisma.nonBillableEnhancementSuggestion.deleteMany();
  await prisma.hourRecord.deleteMany();
  await prisma.syncConflict.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.monthlyRoleDeclaration.deleteMany(); // cascades DeclarationRoleEntry
  await prisma.jiraComponentClientMapping.deleteMany();
  await prisma.nonBillableSourceMapping.deleteMany();
  await prisma.contract.updateMany({ data: { parentContractId: null } });
  await prisma.contract.deleteMany();
  await prisma.statementOfWork.updateMany({ data: { parentSowId: null } });
  await prisma.statementOfWork.deleteMany();
  await prisma.squadMembership.deleteMany();
  await prisma.personRole.deleteMany();
  await prisma.squad.updateMany({ data: { leadPersonId: null } });
  await prisma.squad.deleteMany();
  await prisma.personCapacityHistory.deleteMany();
  await prisma.person.deleteMany();
  await prisma.client.deleteMany();
  await prisma.nonBillableCategory.deleteMany();

  // Insert — FK-safe order
  await prisma.nonBillableCategory.createMany({ data: snapshot.nonBillableCategories });
  await prisma.client.createMany({ data: snapshot.clients });
  await prisma.person.createMany({ data: snapshot.persons });

  // Capacity history: the snapshot carries no PersonCapacityHistory rows, but the
  // capacity analytics read weekly capacity ONLY from this table. Synthesize one
  // open-ended row per person from their current weeklyCapacityHours, anchored to
  // the earliest membership start so every active month is covered.
  const capacityAnchor = [...snapshot.squadMemberships].map((m: any) => m.effectiveFrom).sort()[0];
  await prisma.personCapacityHistory.createMany({
    data: snapshot.persons.map((p: any) => ({
      personId: p.id,
      weeklyCapacityHours: p.weeklyCapacityHours,
      effectiveFrom: capacityAnchor,
      effectiveTo: null,
    })),
  });

  // Squads: insert without leadPersonId, update after memberships are in place
  await prisma.squad.createMany({
    data: snapshot.squads.map((s: any) => ({ ...s, leadPersonId: null })),
  });

  await prisma.personRole.createMany({ data: snapshot.personRoles });
  await prisma.squadMembership.createMany({ data: snapshot.squadMemberships });

  for (const squad of snapshot.squads) {
    if (squad.leadPersonId != null) {
      await prisma.squad.update({
        where: { id: squad.id },
        data: { leadPersonId: squad.leadPersonId },
      });
    }
  }

  // SOWs: parents before children
  const sows = [...snapshot.statementsOfWork].sort((a: any, b: any) =>
    a.parentSowId == null ? -1 : b.parentSowId == null ? 1 : 0
  );
  await prisma.statementOfWork.createMany({
    data: sows.map((s: any) => ({ ...s, parentSowId: null })),
  });
  for (const sow of sows) {
    if (sow.parentSowId != null) {
      await prisma.statementOfWork.update({
        where: { id: sow.id },
        data: { parentSowId: sow.parentSowId },
      });
    }
  }

  // Contracts: parents before children
  const contracts = [...snapshot.contracts].sort((a: any, b: any) =>
    a.parentContractId == null ? -1 : b.parentContractId == null ? 1 : 0
  );
  await prisma.contract.createMany({
    data: contracts.map((c: any) => ({ ...c, parentContractId: null })),
  });
  for (const contract of contracts) {
    if (contract.parentContractId != null) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { parentContractId: contract.parentContractId },
      });
    }
  }

  // Declarations: insert parents (strip nested roles), then flatten role entries
  const decls = snapshot.monthlyRoleDeclarations ?? [];
  await prisma.monthlyRoleDeclaration.createMany({
    data: decls.map(({ roles, ...d }: any) => d),
  });
  await prisma.declarationRoleEntry.createMany({
    data: decls.flatMap((d: any) => d.roles),
  });

  await prisma.nonBillableSourceMapping.createMany({ data: snapshot.nonBillableSourceMappings });
  await prisma.jiraComponentClientMapping.createMany({
    data: snapshot.jiraComponentClientMappings,
  });

  // Reset sequences so new records don't collide with seeded IDs
  const tableSeqs: [string, string][] = [
    ["squads", "id"],
    ["persons", "id"],
    ["squad_memberships", "id"],
    ["person_roles", "id"],
    ["person_capacity_history", "id"],
    ["clients", "id"],
    ["statements_of_work", "id"],
    ["contracts", "id"],
    ["nonbillable_categories", "id"],
    ["nonbillable_source_mappings", "id"],
    ["jira_component_client_mappings", "id"],
    ["monthly_role_declarations", "id"],
    ["declaration_role_entries", "id"],
  ];
  for (const [table] of tableSeqs) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
    );
  }

  console.log("Seed complete", {
    squads: snapshot.squads.length,
    persons: snapshot.persons.length,
    squadMemberships: snapshot.squadMemberships.length,
    personRoles: snapshot.personRoles.length,
    clients: snapshot.clients.length,
    statementsOfWork: snapshot.statementsOfWork.length,
    contracts: snapshot.contracts.length,
    monthlyRoleDeclarations: decls.length,
    nonBillableCategories: snapshot.nonBillableCategories.length,
    nonBillableSourceMappings: snapshot.nonBillableSourceMappings.length,
    jiraComponentClientMappings: snapshot.jiraComponentClientMappings.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
