/**
 * Backfill ContractExtension.resolvedRate / resolvedCurrency
 * for all extensions with status = 'approved'.
 *
 * Logic:
 *   1. If rateOverride is set → use rateOverride as resolvedRate, client currency as resolvedCurrency
 *   2. If rateOverride is NULL → look up TEBillingConfig for clientId:
 *      - type = 'same_rate' → find BillingRate for (clientId, roleType, month) and use that
 *      - otherwise → use TEBillingConfig.value
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ExtRow {
  id: number;
  client_id: number;
  month: Date;
  role_type: string | null;
  rate_override: string | number | null;
}

interface ClientRow {
  currency: string;
}

interface TEConfigRow {
  type: string;
  value: string | number | null;
  currency: string | null;
}

interface BillingRateRow {
  rate_per_hour: string | number;
  currency: string;
}

async function main() {
  const extensions = await prisma.$queryRaw<ExtRow[]>`
    SELECT id, client_id, month, role_type, rate_override
    FROM contract_extensions
    WHERE status = 'approved'
  `;

  console.log(`Found ${extensions.length} approved ContractExtension rows.`);

  let resolved = 0;
  let skipped = 0;

  for (const ext of extensions) {
    // Check if already has resolvedRate set
    const already = await prisma.$queryRaw<Array<{ resolved_rate: unknown }>>`
      SELECT resolved_rate FROM contract_extensions WHERE id = ${ext.id}
    `;
    if (already[0]?.resolved_rate != null) {
      skipped++;
      continue;
    }

    const clientRow = await prisma.$queryRaw<ClientRow[]>`
      SELECT currency FROM clients WHERE id = ${ext.client_id} LIMIT 1
    `;
    const clientCurrency = clientRow[0]?.currency ?? null;

    let resolvedRate: number | null = null;
    let resolvedCurrency: string | null = null;

    if (ext.rate_override !== null && ext.rate_override !== undefined) {
      // 1. Use rateOverride
      resolvedRate = parseFloat(String(ext.rate_override));
      resolvedCurrency = clientCurrency;
    } else {
      // 2. Look up TEBillingConfig
      const teConfig = await prisma.$queryRaw<TEConfigRow[]>`
        SELECT type, value, currency FROM te_billing_configs WHERE client_id = ${ext.client_id} LIMIT 1
      `;
      const cfg = teConfig[0];

      if (cfg) {
        if (cfg.type === "same_rate") {
          // Find BillingRate for (clientId, roleType, month)
          const billingRate = await prisma.$queryRaw<BillingRateRow[]>`
            SELECT rate_per_hour, currency FROM billing_rates
            WHERE client_id = ${ext.client_id}
              AND (role_type = ${ext.role_type}::roletype OR role_type IS NULL)
              AND effective_from <= ${ext.month}
              AND (effective_to IS NULL OR effective_to >= ${ext.month})
            ORDER BY role_type DESC NULLS LAST
            LIMIT 1
          `;
          if (billingRate[0]) {
            resolvedRate = parseFloat(String(billingRate[0].rate_per_hour));
            resolvedCurrency = billingRate[0].currency;
          }
        } else if (cfg.value !== null && cfg.value !== undefined) {
          resolvedRate = parseFloat(String(cfg.value));
          resolvedCurrency = cfg.currency ?? clientCurrency;
        }
      }
    }

    if (resolvedRate !== null) {
      await prisma.$executeRawUnsafe(
        `UPDATE contract_extensions SET resolved_rate = $1, resolved_currency = $2::currency WHERE id = $3`,
        resolvedRate,
        resolvedCurrency,
        ext.id,
      );
      resolved++;
    } else {
      skipped++;
    }
  }

  console.log(`Resolved: ${resolved} extensions`);
  console.log(`Skipped (no rate found or already set): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
