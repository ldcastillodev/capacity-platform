/**
 * Backfill ContractAmendment:
 * For each RetainerContract, insert one ContractAmendment with:
 *   prevPoolHours = 0, newPoolHours = totalPoolHours,
 *   effectiveFrom = validFrom, reason = 'initial backfill'
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.retainerContract.findMany({
    select: {
      id: true,
      totalPoolHours: true,
      validFrom: true,
    },
  });

  console.log(`Found ${contracts.length} RetainerContract rows.`);

  let created = 0;
  let skipped = 0;

  for (const contract of contracts) {
    // Check if an amendment already exists for this contract
    const existing = await prisma.contractAmendment.findFirst({
      where: { contractId: contract.id },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.contractAmendment.create({
      data: {
        contractId: contract.id,
        effectiveFrom: contract.validFrom,
        prevPoolHours: 0,
        newPoolHours: contract.totalPoolHours,
        reason: "initial backfill",
      },
    });
    created++;
  }

  console.log(`Created: ${created} amendments`);
  console.log(`Skipped (already had amendment): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
