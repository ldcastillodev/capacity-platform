import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'db-snapshot.json'), 'utf-8')
  );

  // Clear in reverse FK order
  await prisma.anomalyFlag.deleteMany();
  await prisma.nonBillableEnhancementSuggestion.deleteMany();
  await prisma.hourRecord.deleteMany();
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
  await prisma.person.deleteMany();
  await prisma.client.deleteMany();
  await prisma.nonBillableCategory.deleteMany();

  // Insert — FK-safe order
  await prisma.nonBillableCategory.createMany({ data: snapshot.nonBillableCategories });
  await prisma.client.createMany({ data: snapshot.clients });
  await prisma.person.createMany({ data: snapshot.persons });

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

  await prisma.nonBillableSourceMapping.createMany({ data: snapshot.nonBillableSourceMappings });
  await prisma.jiraComponentClientMapping.createMany({ data: snapshot.jiraComponentClientMappings });

  // Reset sequences so new records don't collide with seeded IDs
  const tableSeqs: [string, string][] = [
    ['squads', 'id'],
    ['persons', 'id'],
    ['squad_memberships', 'id'],
    ['person_roles', 'id'],
    ['clients', 'id'],
    ['statements_of_work', 'id'],
    ['contracts', 'id'],
    ['nonbillable_categories', 'id'],
    ['nonbillable_source_mappings', 'id'],
    ['jira_component_client_mappings', 'id'],
  ];
  for (const [table] of tableSeqs) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
    );
  }

  console.log('Seed complete', {
    squads: snapshot.squads.length,
    persons: snapshot.persons.length,
    squadMemberships: snapshot.squadMemberships.length,
    personRoles: snapshot.personRoles.length,
    clients: snapshot.clients.length,
    statementsOfWork: snapshot.statementsOfWork.length,
    contracts: snapshot.contracts.length,
    nonBillableCategories: snapshot.nonBillableCategories.length,
    nonBillableSourceMappings: snapshot.nonBillableSourceMappings.length,
    jiraComponentClientMappings: snapshot.jiraComponentClientMappings.length,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
