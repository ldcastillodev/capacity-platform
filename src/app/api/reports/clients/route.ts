import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const clientIdParam = searchParams.get("clientId");
  const roleType = searchParams.get("roleType");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));

  const fromDate = from
    ? new Date(from)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const toDate = to ? new Date(to) : fromDate;
  const toMonthEnd = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, 0));

  const clientFilter = clientIdParam
    ? Prisma.sql`AND cl.id = ${Number(clientIdParam)}`
    : Prisma.empty;
  const roleFilterBillable = roleType
    ? Prisma.sql`AND hr.role_type::text = ${roleType}`
    : Prisma.empty;
  const roleFilterDecl = roleType
    ? Prisma.sql`AND mrd.role_type::text = ${roleType}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      client_id: number;
      client_name: string;
      region: string;
      currency: string;
      month: Date;
      consumed_hours: number;
      retainer_hours: number;
      co_hours: number;
      declared_hours: number;
      ceremony_hours: number;
    }[]
  >(Prisma.sql`
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', ${fromDate}::date),
        DATE_TRUNC('month', ${toDate}::date),
        '1 month'::interval
      )::date AS month
    ),
    billable AS (
      SELECT
        hr.client_id,
        DATE_TRUNC('month', hr.date)::date          AS month,
        SUM(hr.hours)                                AS consumed_hours,
        SUM(CASE WHEN c.type = 'base'
                 THEN hr.hours ELSE 0 END)           AS retainer_hours,
        SUM(CASE WHEN c.type = 'change_order'
                 THEN hr.hours ELSE 0 END)           AS co_hours
      FROM hour_records hr
      LEFT JOIN contracts c ON c.id = hr.contract_id
      WHERE hr.is_non_billable = false
        AND hr.client_id IS NOT NULL
        AND hr.date >= ${fromDate}::date
        AND hr.date <= ${toMonthEnd}::date
        ${roleFilterBillable}
      GROUP BY hr.client_id, DATE_TRUNC('month', hr.date)::date
    ),
    declared AS (
      SELECT
        mrd.client_id,
        mrd.month::date AS month,
        SUM(mrd.declared_hours) AS declared_hours
      FROM monthly_role_declarations mrd
      WHERE mrd.month >= ${fromDate}::date
        AND mrd.month <= ${toDate}::date
        ${roleFilterDecl}
      GROUP BY mrd.client_id, mrd.month::date
    ),
    ceremony AS (
      SELECT
        hr.client_id,
        DATE_TRUNC('month', hr.date)::date AS month,
        SUM(hr.hours)                       AS ceremony_hours
      FROM hour_records hr
      JOIN nonbillable_categories nc ON nc.id = hr.nonbillable_category_id
      WHERE hr.is_non_billable = true
        AND nc.type = 'shared_ceremony'
        AND hr.client_id IS NOT NULL
        AND hr.date >= ${fromDate}::date
        AND hr.date <= ${toMonthEnd}::date
      GROUP BY hr.client_id, DATE_TRUNC('month', hr.date)::date
    )
    SELECT
      cl.id              AS client_id,
      cl.name            AS client_name,
      cl.region::text    AS region,
      cl.currency::text  AS currency,
      m.month,
      COALESCE(b.consumed_hours,  0)::float AS consumed_hours,
      COALESCE(b.retainer_hours,  0)::float AS retainer_hours,
      COALESCE(b.co_hours,        0)::float AS co_hours,
      COALESCE(d.declared_hours,  0)::float AS declared_hours,
      COALESCE(cer.ceremony_hours,0)::float AS ceremony_hours
    FROM months m
    CROSS JOIN clients cl
    LEFT JOIN billable b   ON b.client_id   = cl.id AND b.month   = m.month
    LEFT JOIN declared d   ON d.client_id   = cl.id AND d.month   = m.month
    LEFT JOIN ceremony cer ON cer.client_id = cl.id AND cer.month = m.month
    WHERE cl.is_active = true
      AND (b.consumed_hours IS NOT NULL OR d.declared_hours IS NOT NULL)
      ${clientFilter}
    ORDER BY cl.name, m.month
  `);

  const total = rows.length;
  const data = rows
    .slice((page - 1) * pageSize, page * pageSize)
    .map((r, idx) => {
      const consumed = r.consumed_hours;
      const declared = r.declared_hours;
      const remaining = Math.max(declared - consumed, 0);
      const utilizationPct = declared > 0 ? consumed / declared : consumed > 0 ? 1 : 0;
      const month = r.month instanceof Date ? r.month.toISOString() : r.month;
      return {
        id: (page - 1) * pageSize + idx + 1,
        clientId: r.client_id,
        month,
        roleType: roleType ?? null,
        declaredHours: String(declared),
        consumedHours: String(consumed),
        retainerHours: String(r.retainer_hours),
        teHours: "0",
        coHours: String(r.co_hours),
        smeHours: "0",
        remainingHours: String(remaining),
        utilizationPct: String(utilizationPct),
        billedRevenue: null,
        directCost: null,
        grossMargin: null,
        grossMarginPct: null,
        ceremonyHours: r.ceremony_hours,
        client: {
          id: r.client_id,
          name: r.client_name,
          region: r.region,
          currency: r.currency,
        },
      };
    });

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
