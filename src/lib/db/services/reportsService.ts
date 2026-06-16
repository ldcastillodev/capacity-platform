import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Db } from "../types";

/**
 * Raw SQL for the hours report. The dimension SELECT / GROUP BY and the period
 * granularity are dynamic, so these stay raw. All dynamic SQL is built from
 * hardcoded `Prisma.sql` fragments and parameterized filters by the caller —
 * user input is never interpolated into the column expressions.
 *
 * HourRecord (hour_records) is the source of truth for actual hours here.
 */

/** A report row keyed by `d{i}_key` / `d{i}_label` plus billable/nb sums. */
export type HoursReportRow = Record<string, string | number>;

/** A per-period billable / non-billable series point. */
export type HoursReportSeriesRow = { period: string; billable: number; non_billable: number };

/** Prepared SQL fragments for the dimension-grouped report rows. */
export type HoursReportRowsArgs = {
  /** `key AS d0_key, label AS d0_label, ...` */
  dimSelect: Prisma.Sql;
  /** `FROM hour_records hr LEFT JOIN ...` */
  fromJoins: Prisma.Sql;
  /** ANDed WHERE predicates. */
  hrWhere: Prisma.Sql;
  /** `d0_key, d0_label, ...` for GROUP BY. */
  dimAliases: string;
  /** `d0_label, ...` for ORDER BY. */
  labelAliases: string;
};

/** Prepared SQL fragments for the per-period chart series. */
export type HoursReportSeriesArgs = {
  /** The granularity period expression (day/week/month truncation). */
  periodExpr: Prisma.Sql;
  fromJoins: Prisma.Sql;
  hrWhere: Prisma.Sql;
};

/**
 * Aggregate billable + non-billable hours grouped by the selected dimensions.
 * Empty → [].
 */
export function getHoursReportRows(args: HoursReportRowsArgs, db: Db = prisma) {
  return db.$queryRaw<HoursReportRow[]>(Prisma.sql`
    SELECT
      ${args.dimSelect},
      SUM(CASE WHEN hr.is_non_billable = false THEN hr.hours ELSE 0 END)::float AS billable_hours,
      SUM(CASE WHEN hr.is_non_billable = true  THEN hr.hours ELSE 0 END)::float AS nb_hours
    ${args.fromJoins}
    WHERE ${args.hrWhere}
    GROUP BY ${Prisma.raw(args.dimAliases)}
    ORDER BY ${Prisma.raw(args.labelAliases)}
  `);
}

/**
 * Aggregate billable + non-billable hours per period at the chosen granularity.
 * Empty → [].
 */
export function getHoursReportSeries(args: HoursReportSeriesArgs, db: Db = prisma) {
  return db.$queryRaw<HoursReportSeriesRow[]>(Prisma.sql`
    SELECT
      ${args.periodExpr} AS period,
      SUM(CASE WHEN hr.is_non_billable = false THEN hr.hours ELSE 0 END)::float AS billable,
      SUM(CASE WHEN hr.is_non_billable = true  THEN hr.hours ELSE 0 END)::float AS non_billable
    ${args.fromJoins}
    WHERE ${args.hrWhere}
    GROUP BY period
    ORDER BY period
  `);
}
