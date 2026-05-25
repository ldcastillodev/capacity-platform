import { PrismaClient } from "@prisma/client";
import { runAnalyticsRefresh } from "../src/lib/analytics/refresh";

const prisma = new PrismaClient();

// Current month (analytics refresh computes from today; seed matches)
const today = new Date();
const CUR = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
const PRIOR = new Date(Date.UTC(CUR.getUTCFullYear(), CUR.getUTCMonth() - 1, 1));

function day(month: Date, d: number): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d));
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v));
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.nonBillableEnhancementSuggestion.deleteMany(),
    prisma.monthlyCeremonyAllocation.deleteMany(),
    prisma.monthlyNonBillableSummary.deleteMany(),
    prisma.anomalyFlag.deleteMany(),
    prisma.staffingGapSnapshot.deleteMany(),
    prisma.ceremonyAttribution.deleteMany(),
    prisma.monthlyConsumptionSummary.deleteMany(),
    prisma.weeklyBurnSnapshot.deleteMany(),
    prisma.nonBillableEntry.deleteMany(),
    prisma.hourRecord.deleteMany(),
    prisma.syncLog.deleteMany(),
    prisma.monthlyRoleDeclaration.deleteMany(),
    prisma.changeOrderLineItem.deleteMany(),
    prisma.changeOrder.deleteMany(),
    prisma.contractExtension.deleteMany(),
    prisma.billingRate.deleteMany(),
    prisma.costRate.deleteMany(),
    prisma.retainerContract.deleteMany(),
    prisma.clientPersonAccess.deleteMany(),
    prisma.sMEEngagement.deleteMany(),
    prisma.nonBillableSourceMapping.deleteMany(),  // before nonBillableCategory (FK)
    prisma.nonBillableCategory.deleteMany(),
    prisma.personCalendarAssignment.deleteMany(),
    prisma.holidayEntry.deleteMany(),
    prisma.holidayCalendar.deleteMany(),
    prisma.personRole.deleteMany(),
    prisma.squadMembership.deleteMany(),
    prisma.squadCapacityConfig.deleteMany(),
    prisma.clientSimulationLineItem.deleteMany(),
    prisma.clientSimulation.deleteMany(),
    prisma.jiraComponentClientMapping.deleteMany(),
    prisma.tempoAccountClientMapping.deleteMany(),
    prisma.roleCascadeRule.deleteMany(),
    prisma.tEBillingRoleRate.deleteMany(),
    prisma.tEBillingConfig.deleteMany(),
  ]);
  // Clear in order to avoid FK violations
  await prisma.client.deleteMany();
  await prisma.person.deleteMany();
  await prisma.squad.deleteMany();

  console.log("Seeding squads…");
  const squadAlpha = await prisma.squad.create({ data: { name: "Alpha Squad" } });
  const squadBeta = await prisma.squad.create({ data: { name: "Beta Squad" } });

  console.log("Seeding people…");
  const alice = await prisma.person.create({
    data: { name: "Alice Chen", email: "alice.chen@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });
  const bob = await prisma.person.create({
    data: { name: "Bob Torres", email: "bob.torres@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });
  const carol = await prisma.person.create({
    data: { name: "Carol Diaz", email: "carol.diaz@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });
  const dave = await prisma.person.create({
    data: { name: "Dave Kim", email: "dave.kim@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });
  const eve = await prisma.person.create({
    data: { name: "Eve Obi", email: "eve.obi@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });
  const frank = await prisma.person.create({
    data: { name: "Frank Rossi", email: "frank.rossi@apply.digital", weeklyCapacityHours: 40, isActive: true },
  });

  console.log("Seeding squad memberships…");
  const memberStart = new Date("2026-01-01");
  await prisma.squadMembership.createMany({
    data: [
      { personId: alice.id, squadId: squadAlpha.id, allocationPct: 1.0, effectiveFrom: memberStart },
      { personId: bob.id,   squadId: squadAlpha.id, allocationPct: 1.0, effectiveFrom: memberStart },
      { personId: carol.id, squadId: squadAlpha.id, allocationPct: 1.0, effectiveFrom: memberStart },
      { personId: dave.id,  squadId: squadBeta.id,  allocationPct: 1.0, effectiveFrom: memberStart },
      { personId: eve.id,   squadId: squadBeta.id,  allocationPct: 1.0, effectiveFrom: memberStart },
      { personId: frank.id, squadId: squadBeta.id,  allocationPct: 1.0, effectiveFrom: memberStart },
    ],
  });

  console.log("Seeding person roles…");
  await prisma.personRole.createMany({
    data: [
      { personId: alice.id, roleType: "frontend_dev",    seniority: "L3", isPrimary: true, effectiveFrom: memberStart },
      { personId: bob.id,   roleType: "frontend_dev",    seniority: "L2", isPrimary: true, effectiveFrom: memberStart },
      { personId: carol.id, roleType: "tech_lead",       seniority: "L4", isPrimary: true, effectiveFrom: memberStart },
      { personId: dave.id,  roleType: "backend_dev",     seniority: "L3", isPrimary: true, effectiveFrom: memberStart },
      { personId: eve.id,   roleType: "qa",              seniority: "L2", isPrimary: true, effectiveFrom: memberStart },
      { personId: frank.id, roleType: "project_manager", seniority: "L3", isPrimary: true, effectiveFrom: memberStart },
    ],
  });

  console.log("Seeding squad capacity configs…");
  await prisma.squadCapacityConfig.createMany({
    data: [
      { squadId: squadAlpha.id, roleType: "frontend_dev",    hardBufferPct: 0.10, softBufferPct: 0.05 },
      { squadId: squadAlpha.id, roleType: "tech_lead",       hardBufferPct: 0.10, softBufferPct: 0.05 },
      { squadId: squadBeta.id,  roleType: "backend_dev",     hardBufferPct: 0.10, softBufferPct: 0.05 },
      { squadId: squadBeta.id,  roleType: "qa",              hardBufferPct: 0.10, softBufferPct: 0.05 },
      { squadId: squadBeta.id,  roleType: "project_manager", hardBufferPct: 0.10, softBufferPct: 0.05 },
    ],
  });

  console.log("Seeding clients…");
  const techCorp = await prisma.client.create({
    data: { name: "TechCorp", region: "emea", currency: "USD", isActive: true },
  });
  const globalMedia = await prisma.client.create({
    data: { name: "GlobalMedia", region: "emea", currency: "GBP", isActive: true },
  });

  console.log("Seeding retainer contracts…");
  const contractStart = new Date("2026-01-01");
  const tcContract = await prisma.retainerContract.create({
    data: {
      clientId: techCorp.id,
      squadId: squadAlpha.id,
      totalPoolHours: 160,
      status: "active",
      validFrom: contractStart,
    },
  });
  const gmContract = await prisma.retainerContract.create({
    data: {
      clientId: globalMedia.id,
      squadId: squadBeta.id,
      totalPoolHours: 80,
      status: "active",
      validFrom: contractStart,
    },
  });

  console.log("Seeding billing rates…");
  const brStart = new Date("2026-01-01");
  await prisma.billingRate.createMany({
    data: [
      { clientId: techCorp.id,    roleType: "frontend_dev",    ratePerHour: 120, currency: "USD", effectiveFrom: brStart },
      { clientId: techCorp.id,    roleType: "tech_lead",       ratePerHour: 150, currency: "USD", effectiveFrom: brStart },
      { clientId: globalMedia.id, roleType: "backend_dev",     ratePerHour: 100, currency: "GBP", effectiveFrom: brStart },
      { clientId: globalMedia.id, roleType: "qa",              ratePerHour: 80,  currency: "GBP", effectiveFrom: brStart },
    ],
  });

  console.log("Seeding declarations (prior + current months)…");
  // Prior month declarations (TechCorp)
  await prisma.monthlyRoleDeclaration.createMany({
    data: [
      { contractId: tcContract.id, clientId: techCorp.id, squadId: squadAlpha.id, month: PRIOR, roleType: "frontend_dev", declaredHours: 120, status: "confirmed" },
      { contractId: tcContract.id, clientId: techCorp.id, squadId: squadAlpha.id, month: PRIOR, roleType: "tech_lead",    declaredHours: 40,  status: "confirmed" },
      { contractId: gmContract.id, clientId: globalMedia.id, squadId: squadBeta.id, month: PRIOR, roleType: "backend_dev", declaredHours: 80, status: "confirmed" },
    ],
  });
  // Current month declarations
  await prisma.monthlyRoleDeclaration.createMany({
    data: [
      { contractId: tcContract.id, clientId: techCorp.id, squadId: squadAlpha.id, month: CUR, roleType: "frontend_dev", declaredHours: 120, status: "confirmed" },
      { contractId: tcContract.id, clientId: techCorp.id, squadId: squadAlpha.id, month: CUR, roleType: "tech_lead",    declaredHours: 40,  status: "confirmed" },
      { contractId: gmContract.id, clientId: globalMedia.id, squadId: squadBeta.id, month: CUR, roleType: "backend_dev", declaredHours: 80, status: "confirmed" },
    ],
  });

  console.log("Seeding hour records (prior month)…");
  // Distribute ~108h frontend_dev across prior month
  // 9h * 6 days = 54h per person (Alice + Bob = 108h frontend_dev total)
  // 9h * 4 days = 36h tech_lead (Carol)
  // 9h * 4 days = 36h backend_dev (Dave); Eve/Frank = NB only

  const priorDays = [2, 5, 9, 12, 16, 19] as const;
  const priorTechLeadDays = [2, 9, 16, 23] as const;
  const priorBeDays = [2, 9, 16, 23] as const;

  const priorHours: {personId: number; clientId: number; date: Date; hours: number; roleType: string; budgetSource: string}[] = [];

  for (const d of priorDays) {
    priorHours.push({ personId: alice.id, clientId: techCorp.id, date: day(PRIOR, d), hours: 9, roleType: "frontend_dev", budgetSource: "retainer" });
    priorHours.push({ personId: bob.id,   clientId: techCorp.id, date: day(PRIOR, d), hours: 9, roleType: "frontend_dev", budgetSource: "retainer" });
  }
  for (const d of priorTechLeadDays) {
    priorHours.push({ personId: carol.id, clientId: techCorp.id, date: day(PRIOR, d), hours: 9, roleType: "tech_lead", budgetSource: "retainer" });
  }
  for (const d of priorBeDays) {
    priorHours.push({ personId: dave.id, clientId: globalMedia.id, date: day(PRIOR, d), hours: 9, roleType: "backend_dev", budgetSource: "retainer" });
  }

  await prisma.hourRecord.createMany({ data: priorHours.map((h) => ({ ...h, source: "manual", roleType: h.roleType as never, budgetSource: h.budgetSource as never })) });

  console.log("Seeding hour records (current month)…");
  const curDays = [2, 5, 9, 12, 16] as const;
  const curTechLeadDays = [2, 9, 16, 21] as const;
  const curBeDays = [2, 9, 16, 21] as const;

  const curHours: {personId: number; clientId: number; date: Date; hours: number; roleType: string; budgetSource: string}[] = [];

  for (const d of curDays) {
    curHours.push({ personId: alice.id, clientId: techCorp.id, date: day(CUR, d), hours: 9, roleType: "frontend_dev", budgetSource: "retainer" });
    curHours.push({ personId: bob.id,   clientId: techCorp.id, date: day(CUR, d), hours: 9, roleType: "frontend_dev", budgetSource: "retainer" });
  }
  for (const d of curTechLeadDays) {
    curHours.push({ personId: carol.id, clientId: techCorp.id, date: day(CUR, d), hours: 9, roleType: "tech_lead", budgetSource: "retainer" });
  }
  for (const d of curBeDays) {
    curHours.push({ personId: dave.id, clientId: globalMedia.id, date: day(CUR, d), hours: 9, roleType: "backend_dev", budgetSource: "retainer" });
  }

  await prisma.hourRecord.createMany({ data: curHours.map((h) => ({ ...h, source: "manual", roleType: h.roleType as never, budgetSource: h.budgetSource as never })) });

  console.log("Seeding NB categories…");
  const catLeave      = await prisma.nonBillableCategory.create({ data: { name: "Annual Leave",          type: "leave",            description: "Planned or unplanned leave" } });
  const catMeeting    = await prisma.nonBillableCategory.create({ data: { name: "Internal Meeting",      type: "internal_meeting", description: "Non-client internal meetings" } });
  const catTraining   = await prisma.nonBillableCategory.create({ data: { name: "Training & Learning",   type: "training",         description: "Courses, workshops, self-learning" } });
  const catCeremony   = await prisma.nonBillableCategory.create({ data: { name: "MgS Shared Ceremonies", type: "shared_ceremony",  description: "Cross-squad ceremonies (scrum, retros)" } });
  const catCompany    = await prisma.nonBillableCategory.create({ data: { name: "Company Activities",    type: "company",          description: "Company events, onboarding, offsites" } });

  console.log("Seeding NB entries (prior month)…");
  await prisma.nonBillableEntry.createMany({
    data: [
      // Alice – 16h leave
      { personId: alice.id, squadId: squadAlpha.id, date: day(PRIOR, 3),  hours: 8, categoryId: catLeave.id },
      { personId: alice.id, squadId: squadAlpha.id, date: day(PRIOR, 4),  hours: 8, categoryId: catLeave.id },
      // Bob – 8h training
      { personId: bob.id,   squadId: squadAlpha.id, date: day(PRIOR, 10), hours: 8, categoryId: catTraining.id },
      // Carol – 8h shared ceremony
      { personId: carol.id, squadId: squadAlpha.id, date: day(PRIOR, 6),  hours: 8, categoryId: catCeremony.id },
      // Dave – 16h internal meeting
      { personId: dave.id,  squadId: squadBeta.id,  date: day(PRIOR, 7),  hours: 8, categoryId: catMeeting.id },
      { personId: dave.id,  squadId: squadBeta.id,  date: day(PRIOR, 14), hours: 8, categoryId: catMeeting.id },
      // Eve – 8h company
      { personId: eve.id,   squadId: squadBeta.id,  date: day(PRIOR, 8),  hours: 8, categoryId: catCompany.id },
      // Frank – 8h shared ceremony
      { personId: frank.id, squadId: squadBeta.id,  date: day(PRIOR, 11), hours: 8, categoryId: catCeremony.id },
    ],
  });

  console.log("Seeding NB entries (current month)…");
  await prisma.nonBillableEntry.createMany({
    data: [
      // Alice – 8h leave + 8h training (total 16h NB)
      { personId: alice.id, squadId: squadAlpha.id, date: day(CUR, 3),  hours: 8, categoryId: catLeave.id },
      { personId: alice.id, squadId: squadAlpha.id, date: day(CUR, 15), hours: 8, categoryId: catTraining.id },
      // Bob – 16h internal meeting
      { personId: bob.id,   squadId: squadAlpha.id, date: day(CUR, 6),  hours: 8, categoryId: catMeeting.id },
      { personId: bob.id,   squadId: squadAlpha.id, date: day(CUR, 13), hours: 8, categoryId: catMeeting.id },
      // Carol – 8h ceremony + 8h internal meeting
      { personId: carol.id, squadId: squadAlpha.id, date: day(CUR, 7),  hours: 8, categoryId: catCeremony.id },
      { personId: carol.id, squadId: squadAlpha.id, date: day(CUR, 14), hours: 8, categoryId: catMeeting.id },
      // Dave – 8h leave
      { personId: dave.id,  squadId: squadBeta.id,  date: day(CUR, 4),  hours: 8, categoryId: catLeave.id },
      // Eve – 8h training + 8h ceremony
      { personId: eve.id,   squadId: squadBeta.id,  date: day(CUR, 8),  hours: 8, categoryId: catTraining.id },
      { personId: eve.id,   squadId: squadBeta.id,  date: day(CUR, 11), hours: 8, categoryId: catCeremony.id },
      // Frank – 8h company + 16h internal meeting
      { personId: frank.id, squadId: squadBeta.id,  date: day(CUR, 5),  hours: 8, categoryId: catCompany.id },
      { personId: frank.id, squadId: squadBeta.id,  date: day(CUR, 12), hours: 8, categoryId: catMeeting.id },
      { personId: frank.id, squadId: squadBeta.id,  date: day(CUR, 19), hours: 8, categoryId: catMeeting.id },
    ],
  });

  // ── Pre-seed prior-month NB summaries so MoM delta works ─────────────────────
  console.log("Pre-seeding prior-month NB summaries for MoM delta…");
  const weekCapacity = 40;
  const approxCapacity = Math.round(weekCapacity * 4.33);
  const priorNbPersonData: Array<{ personId: number; squadId: number; totalHours: number; categories: Array<{type: string|null; hours: number}> }> = [
    { personId: alice.id, squadId: squadAlpha.id, totalHours: 16, categories: [
        { type: null,       hours: 16 },
        { type: "leave",    hours: 16 },
    ]},
    { personId: bob.id, squadId: squadAlpha.id, totalHours: 8, categories: [
        { type: null,       hours: 8 },
        { type: "training", hours: 8 },
    ]},
    { personId: carol.id, squadId: squadAlpha.id, totalHours: 8, categories: [
        { type: null,              hours: 8 },
        { type: "shared_ceremony", hours: 8 },
    ]},
    { personId: dave.id, squadId: squadBeta.id, totalHours: 16, categories: [
        { type: null,              hours: 16 },
        { type: "internal_meeting",hours: 16 },
    ]},
    { personId: eve.id, squadId: squadBeta.id, totalHours: 8, categories: [
        { type: null,    hours: 8 },
        { type: "company", hours: 8 },
    ]},
    { personId: frank.id, squadId: squadBeta.id, totalHours: 8, categories: [
        { type: null,              hours: 8 },
        { type: "shared_ceremony", hours: 8 },
    ]},
  ];

  for (const p of priorNbPersonData) {
    // Total logged = billable + NB (prior month)
    const priorBillable = priorHours.filter((h) => h.personId === p.personId).reduce((s, h) => s + h.hours, 0);
    const totalLogged = priorBillable + p.totalHours;

    for (const cat of p.categories) {
      const pct = totalLogged > 0 ? cat.hours / totalLogged : 0;
      await prisma.monthlyNonBillableSummary.create({
        data: {
          personId: p.personId,
          squadId: p.squadId,
          month: PRIOR,
          categoryType: cat.type as never ?? null,
          totalHours: cat.hours,
          capacityHours: approxCapacity,
          nonbillablePct: Math.round(pct * 10000) / 10000,
          billableHoursLost: cat.hours,
          priorMonthHours: null,
          monthOverMonthDelta: null,
        },
      });
    }
  }

  // ── Run analytics refresh ──────────────────────────────────────────────────
  console.log("Running analytics refresh…");
  await runAnalyticsRefresh();

  console.log("Seed complete.");
  console.log(`  Squads: Alpha Squad (${squadAlpha.id}), Beta Squad (${squadBeta.id})`);
  console.log(`  Clients: TechCorp (${techCorp.id}), GlobalMedia (${globalMedia.id})`);
  console.log(`  People: ${[alice,bob,carol,dave,eve,frank].map((p)=>p.name).join(", ")}`);
  console.log(`  Month: ${CUR.toISOString().substring(0,7)}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
