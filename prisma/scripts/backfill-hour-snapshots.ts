/**
 * Backfill HourRecord snapshot columns:
 *   billingRateSnapshot, costRateSnapshot, currencySnapshot,
 *   billedAmountSnapshot, costAmountSnapshot
 *
 * Uses raw SQL for rate lookups to avoid Prisma enum cast issues.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RateRow {
  rate_per_hour: string | number;
  currency: string;
}

async function getBillingRate(clientId: number, roleType: string, date: Date): Promise<RateRow | null> {
  const rows = await prisma.$queryRaw<RateRow[]>`
    SELECT rate_per_hour, currency
    FROM billing_rates
    WHERE client_id = ${clientId}
      AND effective_from <= ${date}
      AND (effective_to IS NULL OR effective_to >= ${date})
      AND (role_type = ${roleType}::roletype OR role_type IS NULL)
    ORDER BY role_type DESC NULLS LAST
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getCostRate(personId: number, roleType: string, date: Date): Promise<RateRow | null> {
  const rows = await prisma.$queryRaw<RateRow[]>`
    SELECT rate_per_hour, currency
    FROM cost_rates
    WHERE effective_from <= ${date}
      AND (effective_to IS NULL OR effective_to >= ${date})
      AND (person_id = ${personId} OR person_id IS NULL)
      AND (role_type = ${roleType}::roletype OR role_type IS NULL)
    ORDER BY person_id DESC NULLS LAST
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function main() {
  const records = await prisma.$queryRaw<Array<{
    id: number;
    client_id: number;
    person_id: number;
    role_type: string;
    date: Date;
    hours: string | number;
  }>>`
    SELECT id, client_id, person_id, role_type, date, hours
    FROM hour_records
    WHERE billing_rate_snapshot IS NULL
  `;

  console.log(`Found ${records.length} HourRecord rows to backfill.`);

  let backfilled = 0;
  let leftNull = 0;

  for (const record of records) {
    const billingRate = await getBillingRate(record.client_id, record.role_type, record.date);
    const costRate = await getCostRate(record.person_id, record.role_type, record.date);

    const hoursNum = parseFloat(String(record.hours));
    const billingRateVal = billingRate ? parseFloat(String(billingRate.rate_per_hour)) : null;
    const costRateVal = costRate ? parseFloat(String(costRate.rate_per_hour)) : null;
    const currency = billingRate?.currency ?? costRate?.currency ?? null;

    const billedAmount = billingRateVal !== null ? round4(hoursNum * billingRateVal) : null;
    const costAmount = costRateVal !== null ? round4(hoursNum * costRateVal) : null;

    const hasAny = billingRateVal !== null || costRateVal !== null;

    if (hasAny) {
      const updates: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (billingRateVal !== null) {
        updates.push(`billing_rate_snapshot = $${idx++}`);
        params.push(billingRateVal);
      }
      if (costRateVal !== null) {
        updates.push(`cost_rate_snapshot = $${idx++}`);
        params.push(costRateVal);
      }
      if (currency !== null) {
        updates.push(`currency_snapshot = $${idx++}::currency`);
        params.push(currency);
      }
      if (billedAmount !== null) {
        updates.push(`billed_amount_snapshot = $${idx++}`);
        params.push(billedAmount);
      }
      if (costAmount !== null) {
        updates.push(`cost_amount_snapshot = $${idx++}`);
        params.push(costAmount);
      }
      params.push(record.id);

      await prisma.$executeRawUnsafe(
        `UPDATE hour_records SET ${updates.join(", ")} WHERE id = $${idx}`,
        ...params
      );
      backfilled++;
    } else {
      leftNull++;
    }
  }

  console.log(`Backfilled: ${backfilled} rows`);
  console.log(`Left NULL (no rate found): ${leftNull} rows`);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
