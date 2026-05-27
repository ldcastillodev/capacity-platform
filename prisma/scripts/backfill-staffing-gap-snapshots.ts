/**
 * Backfill StaffingGapSnapshot snapshot columns:
 *   capacityHoursAtTime, hardBufferPctAtTime, softBufferPctAtTime
 *
 * - capacityHoursAtTime = totalAvailableHours (best proxy available)
 * - hardBufferPctAtTime / softBufferPctAtTime from SquadCapacityConfig(squadId, roleType)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const snapshots = await prisma.$queryRaw<Array<{
    id: number;
    squad_id: number;
    role_type: string;
    total_available_hours: string | number;
  }>>`
    SELECT id, squad_id, role_type, total_available_hours
    FROM staffing_gap_snapshots
    WHERE capacity_hours_at_time IS NULL
  `;

  console.log(`Found ${snapshots.length} StaffingGapSnapshot rows to backfill.`);

  let backfilled = 0;
  let leftNull = 0;

  for (const snap of snapshots) {
    const config = await prisma.$queryRaw<Array<{
      hard_buffer_pct: string | number;
      soft_buffer_pct: string | number;
    }>>`
      SELECT hard_buffer_pct, soft_buffer_pct
      FROM squad_capacity_configs
      WHERE squad_id = ${snap.squad_id}
        AND role_type = ${snap.role_type}::roletype
      LIMIT 1
    `;

    const cfg = config[0];
    const capacityHours = parseFloat(String(snap.total_available_hours));

    if (cfg) {
      await prisma.$executeRaw`
        UPDATE staffing_gap_snapshots
        SET
          capacity_hours_at_time  = ${capacityHours},
          hard_buffer_pct_at_time = ${parseFloat(String(cfg.hard_buffer_pct))},
          soft_buffer_pct_at_time = ${parseFloat(String(cfg.soft_buffer_pct))}
        WHERE id = ${snap.id}
      `;
      backfilled++;
    } else {
      // No config found — set only capacityHoursAtTime, leave buffer pcts NULL
      await prisma.$executeRaw`
        UPDATE staffing_gap_snapshots
        SET capacity_hours_at_time = ${capacityHours}
        WHERE id = ${snap.id}
      `;
      leftNull++;
    }
  }

  console.log(`Backfilled with config: ${backfilled} rows`);
  console.log(`Set capacityHoursAtTime only (no config): ${leftNull} rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
