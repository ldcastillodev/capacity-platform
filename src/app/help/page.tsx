"use client";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AlertTone = "safe" | "watch" | "warning" | "critical";
const TAG_TONE: Record<AlertTone, string> = {
  safe: "bg-safe-bg text-safe",
  watch: "bg-watch-bg text-watch",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  );
}

function SectionH3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-sm mt-4 mb-2">{children}</h3>;
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-sm text-muted-foreground leading-relaxed${className ? " " + className : ""}`}
    >
      {children}
    </p>
  );
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted rounded-lg px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto">
      {children}
    </pre>
  );
}

function Tag({ tone, children }: { tone: AlertTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-bold", TAG_TONE[tone])}>
      {children}
    </span>
  );
}

import React from "react";

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="How to Use"
        description="Rules, thresholds, and logic behind every number in this platform."
      />

      <Section title="Alert Levels" subtitle="Used on Overview, Burn Rate, and Anomaly Flags.">
        <P>
          Every client receives one of four alert levels, recalculated each time the burn snapshot
          job runs (daily at 02:30, or on-demand). The level is driven by two independent checks —
          whichever is more severe wins.
        </P>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Overburn condition</TableHead>
                <TableHead>Underburn condition</TableHead>
                <TableHead>What it means</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  level: "Safe",
                  tone: "safe" as AlertTone,
                  over: "Proj. EOM ≤ 95% of pool",
                  under: "Burn ratio ≥ 60%",
                  desc: "Consuming hours at a healthy pace. No action needed.",
                },
                {
                  level: "Watch",
                  tone: "watch" as AlertTone,
                  over: "Proj. EOM > 95% of pool",
                  under: "Burn ratio < 60%",
                  desc: "Slightly ahead of pace or underutilising. Worth monitoring.",
                },
                {
                  level: "Warning",
                  tone: "warning" as AlertTone,
                  over: "Proj. EOM > 100% of pool",
                  under: "Burn ratio < 40%",
                  desc: "Overrun likely, or significantly below pace. Needs attention.",
                },
                {
                  level: "Critical",
                  tone: "critical" as AlertTone,
                  over: "Proj. EOM > 110% of pool",
                  under: "Burn ratio < 20%",
                  desc: "Overrun almost certain, or near-zero activity. Act now.",
                },
              ].map(({ level, tone, over, under, desc }) => (
                <TableRow key={level}>
                  <TableCell>
                    <Tag tone={tone}>{level}</Tag>
                  </TableCell>
                  <TableCell>{over}</TableCell>
                  <TableCell>{under}</TableCell>
                  <TableCell className="text-muted-foreground">{desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <P>
          A client gets the <strong>worst</strong> level triggered by either condition. For example,
          a client with a burn ratio of 15% (underburn → Critical) but a projected EOM within pool
          would still be flagged Critical.
        </P>
      </Section>

      <Section
        title="Burn Rate"
        subtitle="The Burn Rate page and the burn_rate_ratio metric on Overview."
      >
        <P>
          Burn rate measures how fast a client is consuming their monthly hour pool compared to an
          idealised straight-line pace. It is recalculated weekly (every Monday) and backfilled for
          all prior weeks of the current month.
        </P>
        <SectionH3>Key formulas</SectionH3>
        <FormulaBox>{`Expected pace (at any point in month)
expected_cumulative = pool_hours × (calendar_days_elapsed ÷ calendar_days_in_month)

Burn ratio
burn_rate_ratio = actual_cumulative_hours ÷ expected_cumulative

Projected end-of-month
projected_eom = (hours_to_date ÷ days_elapsed) × days_in_month`}</FormulaBox>
        <P>
          <strong>Expected pace</strong> uses calendar days for both numerator and denominator, so
          it rises linearly from 0 on day 1 to exactly the pool limit on the last day of the month —
          it will never exceed the pool line on the chart.
        </P>
        <P>
          <strong>Projected EOM</strong> extrapolates today&apos;s daily average to the full month.
          If a client consumed 60 h in the first 10 days of a 31-day month, the projected EOM = (60
          ÷ 10) × 31 = 186 h.
        </P>
        <Separator />
        <SectionH3>Reading the Burn Rate chart</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>What it shows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <strong className="text-primary">Actual</strong> (solid)
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Cumulative hours logged from the 1st of the month to the end of each week.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <strong className="text-muted-foreground">Expected pace</strong> (dashed)
                </TableCell>
                <TableCell className="text-muted-foreground">
                  The straight-line target. If actual tracks this line, the client will consume
                  exactly their pool by month-end.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <strong className="text-critical">Pool limit</strong> (red dashed)
                </TableCell>
                <TableCell className="text-muted-foreground">
                  The client&apos;s contracted pool hours for the month. The actual line crossing
                  this means overburn.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section
        title="Hours Consumption"
        subtitle="The Consumption page — declared vs actual utilisation."
      >
        <P>
          Consumption is a point-in-time snapshot: how many hours have been logged against a
          client&apos;s <strong>declared</strong> allocation this month, expressed as a percentage.
        </P>
        <FormulaBox>utilisation % = consumed_hours ÷ declared_hours × 100</FormulaBox>
        <P>
          <strong>Declared hours</strong> come from the Monthly Role Declaration — the hours
          allocated per role per client for that month. They are <em>not</em> the same as the
          retainer pool (which is the overall contractual cap). A client can have declared hours
          that add up to less than its pool.
        </P>
        <SectionH3>Why Consumption and Overview can differ</SectionH3>
        <P>
          Overview uses <strong>burn rate</strong> (time-adjusted pace) while Consumption shows{" "}
          <strong>raw utilisation</strong> (no time context). A client at 97% utilisation with 75%
          of the month elapsed is on pace for a 129% overrun by month-end — correctly flagged
          Critical on Overview, but looking almost green on Consumption. Both views are correct;
          they answer different questions:
        </P>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Question answered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Overview / Burn Rate</TableCell>
                <TableCell className="text-muted-foreground">
                  Will this client overrun their pool by month-end if the current pace continues?
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Consumption</TableCell>
                <TableCell className="text-muted-foreground">
                  How much of the declared allocation has been used so far?
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Anomaly Flags" subtitle="Auto-generated warnings that need a human decision.">
        <P>
          Flags are created by the nightly analytics job when a rule-based condition is met. They
          remain open until someone resolves them with a note. A flag is per-client per-month — the
          same issue will not re-fire if it is already open.
        </P>
        <SectionH3>Flag types</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  type: "Overburn",
                  rule: "Projected EOM > 105% of pool. Fires as Warning; escalates to Critical at > 115%.",
                },
                {
                  type: "Underburn",
                  rule: "Projected EOM < 50% of pool and we are past mid-month. Suggests under-staffing or missing timesheets.",
                },
                { type: "Zero hours", rule: "No hours logged at all past week 2 of the month." },
                {
                  type: "Spike",
                  rule: "A single week's hours are more than 2× the prior-week average. Could indicate back-dated entries or a genuine effort spike.",
                },
              ].map(({ type, rule }) => (
                <TableRow key={type}>
                  <TableCell className="font-semibold whitespace-nowrap">{type}</TableCell>
                  <TableCell className="text-muted-foreground">{rule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <P>
          To dismiss a flag without taking action, open it and enter a resolution note (e.g.
          &quot;Client approved additional scope&quot;). Resolved flags are kept for audit history
          but disappear from the open count.
        </P>
      </Section>

      <Section
        title="Non-Billable Hours"
        subtitle="Internal time that doesn't count toward client pools."
      >
        <P>
          A worklog is classified as non-billable when it is logged against a Jira Non billable
          component.
        </P>
        <SectionH3>Utilisation thresholds</SectionH3>
        <FormulaBox>nonbillable_pct = non_billable_hours ÷ total_logged_hours × 100</FormulaBox>
        <P>
          The Non-Billable page surfaces individuals or squads whose non-billable percentage is
          unusually high. Enhancement suggestions are raised automatically when a person exceeds 30%
          non-billable in a month.
        </P>
        <SectionH3>Shared Ceremonies vs Apply General (company)</SectionH3>
        <P>
          <strong>Shared Ceremonies</strong> are distributed to clients at month-end based on each
          person&apos;s proportion of logged billable hours. A person working 60% on Client A and
          40% on Client B will have 60%/40% of their ceremony time attributed to each client
          respectively. This allocation is visible in the Ceremonies column on the Consumption page.
        </P>
        <P>
          <strong>Apply General</strong> (company type) covers company-wide overhead that is NOT
          attributed to any client: disciplinary meetings, company events, recruitment, and internal
          Apply team activities (including NA Apply hours — MP-2980). These hours are tracked for
          cost awareness but do not reduce any client&apos;s remaining pool.
        </P>
        <SectionH3>Enhancement suggestion statuses</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Meaning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { s: "Open", m: "Newly raised — not yet reviewed." },
                { s: "In Review", m: "Someone is investigating the root cause." },
                { s: "Applied", m: "Action taken (e.g. reclassified hours, updated scope)." },
                { s: "Dismissed", m: "Reviewed and accepted as normal (e.g. onboarding week)." },
              ].map(({ s, m }) => (
                <TableRow key={s}>
                  <TableCell className="font-semibold">{s}</TableCell>
                  <TableCell className="text-muted-foreground">{m}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Staffing Gaps" subtitle="Available capacity vs committed hours per role.">
        <P>
          A staffing gap snapshot compares the hours a squad has available in a given role against
          the hours already committed to active client contracts.
        </P>
        <FormulaBox>{`net_gap_hours = total_available_hours × (1 − hard_buffer_pct) − committed_hours
is_understaffed = net_gap_hours < 0`}</FormulaBox>
        <P>
          <strong>Hard buffer</strong> defaults to 15% — capacity reserved for overhead, internal
          work, and unexpected scope changes. It can be overridden per squad in the capacity config.
        </P>
        <P>
          A positive net gap means the squad can absorb more work in that role. A negative gap
          (understaffed) is surfaced in the Overview stat card and will block the New Client
          Simulator from marking a role as &quot;available&quot;.
        </P>
      </Section>

      <Section
        title="New Client Simulator"
        subtitle='"Can we take on this client without hiring?" — answered before you commit.'
      >
        <P>
          Enter the proposed client name, start month, total pool hours, and a breakdown of hours
          needed per role. The simulator checks current staffing gap snapshots and returns a
          feasibility verdict for each role.
        </P>
        <SectionH3>Action codes</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Meaning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { a: "Available", m: "Enough spare capacity in that role. No hiring needed." },
                {
                  a: "Redistribute",
                  m: "Small shortfall (< 0.5 FTE). Rebalancing existing allocations should cover it.",
                },
                {
                  a: "Hire needed",
                  m: "Shortfall ≥ 0.5 FTE. Headcount addition required to deliver safely.",
                },
              ].map(({ a, m }) => (
                <TableRow key={a}>
                  <TableCell className="font-semibold">{a}</TableCell>
                  <TableCell className="text-muted-foreground">{m}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <P>
          FTE estimates assume <strong>160 billable hours/month per FTE</strong>. All simulations
          are saved for audit — you can see who ran what scenario and when.
        </P>
      </Section>

      <Section
        title="Data Sources &amp; Sync"
        subtitle="Where hours come from and how they are routed."
      >
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Routing key</TableHead>
                <TableHead>Sync schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <strong>NA</strong>
                </TableCell>
                <TableCell>Jira native worklogs (applydigital.atlassian.net)</TableCell>
                <TableCell>
                  Jira issue component (e.g. <code>Andertons</code>)
                </TableCell>
                <TableCell>Full sync daily at 02:00; delta every hour</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <SectionH3>What happens to unmapped worklogs?</SectionH3>
        <P>
          If a worklog&apos;s account key or component is not in the mapping table, it is skipped
          and the key is recorded in the <code>sync_logs.unmapped_refs</code> field of that sync
          run. Check <strong>Admin → Sync Logs</strong> (or the API at{" "}
          <code>/api/v1/sync-logs</code>) to see what&apos;s falling through. Add the missing key to
          the mapping table and run a full sync to retroactively pick up the hours.
        </P>
        <SectionH3>Non-billable routing</SectionH3>
        <P>
          A worklog is routed to non-billable (instead of a client) when its account key ends in{" "}
          <code>-NB</code>, matches a key in the non-billable source mapping table, or belongs to an
          LC-prefixed internal project. The person&apos;s squad at the time of the worklog (not
          today) determines which squad the non-billable entry is attributed to — important for
          leavers.
        </P>
      </Section>

      <Section
        title="Month-Specific Contracts"
        subtitle="How to set different pool hours for a single month."
      >
        <P>
          Retainer contracts have a <code>valid_from</code> and <code>valid_to</code> date. To apply
          a different pool for one month only, create a contract row with that month&apos;s first
          and last day and a second row starting the following month with the normal value. The
          system always uses the contract whose date range covers the first day of the month being
          queried.
        </P>
        <P className="italic">
          Example: White Stuff had 468 h in March and 794 h from April onwards — two separate
          contract rows handle this, one with <code>valid_to = 2026-03-31</code> and one with{" "}
          <code>valid_from = 2026-04-01</code>.
        </P>
      </Section>

      <Section title="Refresh Schedule" subtitle="When numbers update automatically.">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>What it updates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  job: "Burn snapshots",
                  sched: "Daily at 02:30 (after full sync)",
                  what: "Recalculates cumulative hours, expected pace, burn ratio, projected EOM, and alert level for every client. Backfills all weeks of the current month.",
                },
                {
                  job: "Analytics refresh",
                  sched: "Daily at 02:30 (with burn snapshots)",
                  what: "Rebuilds consumption summaries, staffing gap snapshots, anomaly flags, and non-billable summaries.",
                },
              ].map(({ job, sched, what }) => (
                <TableRow key={job}>
                  <TableCell className="font-semibold whitespace-nowrap">{job}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{sched}</TableCell>
                  <TableCell className="text-muted-foreground">{what}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <P>
          Any job can be triggered immediately via <strong>Admin → Jobs</strong> in the API docs (
          <code>POST /api/v1/admin/jobs/all</code> runs everything in sequence). Use this after
          manually correcting contracts, mappings, or declared hours so the dashboards reflect the
          change without waiting for the overnight run.
        </P>
      </Section>

      <Section title="Client-Approved T&amp;E Extensions">
        <P>
          Sometimes a client approves additional hours beyond their monthly retainer — for a sprint
          overrun, an urgent deliverable, or a change in scope. These are called{" "}
          <strong>T&amp;E (Time &amp; Expense) extensions</strong> and they behave differently from
          regular overburn:
        </P>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <strong>They are pre-approved by the client</strong>, so they should not trigger
            CRITICAL or WARNING alerts against the base retainer pool.
          </li>
          <li>
            <strong>The extra hours are billable</strong> at the T&amp;E rate and count as
            additional revenue for the month — they are tracked separately from retainer revenue.
          </li>
          <li>
            <strong>The effective pool expands</strong>: once an extension is approved, the{" "}
            <em>Remaining</em> column on the Consumption page increases and consumption % is
            recalculated against the combined pool (retainer + T&amp;E).
          </li>
        </ul>
        <SectionH3>How to register an extension</SectionH3>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
          <li>
            Go to <strong>Consumption</strong> in the sidebar.
          </li>
          <li>
            Scroll to <strong>Client-Approved T&amp;E Extensions</strong> at the bottom of the page.
          </li>
          <li>
            Find the client row and click <strong>Add T&amp;E</strong>.
          </li>
          <li>
            Fill in the month, the number of approved extra hours, and optionally the role type and
            a note.
          </li>
          <li>
            Click <strong>Save</strong>. The extension is saved with status <em>Approved</em>{" "}
            immediately. The consumption table updates in place.
          </li>
        </ol>
        <SectionH3>Statuses</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Meaning</TableHead>
                <TableHead>Effect on pool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "Pending approval",
                  "Extension has been logged but not yet confirmed by the client.",
                  "Does NOT expand the pool yet. Alerts remain in place.",
                ],
                [
                  "Approved",
                  "Client has confirmed the extra hours. Saved via the form with status=approved.",
                  "Pool expands immediately. Consumption % is recalculated. CRITICAL/WARNING risk removed for these hours.",
                ],
              ].map(([status, meaning, effect]) => (
                <TableRow key={status}>
                  <TableCell className="font-semibold whitespace-nowrap">{status}</TableCell>
                  <TableCell className="text-muted-foreground">{meaning}</TableCell>
                  <TableCell className="text-muted-foreground">{effect}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <P>
          <strong>Note:</strong> T&amp;E extensions are month-specific. An approval for March does
          not carry over to April. You must register a new extension each month if the client
          continues to approve additional hours.
        </P>
      </Section>

      <Section title="Glossary">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Definition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "Pool hours",
                  "The total contracted hours for a client in a given month (from the retainer contract).",
                ],
                [
                  "Declared hours",
                  "Hours allocated per role per client for a month (from the Monthly Role Declaration). Used in the Consumption page.",
                ],
                [
                  "Burn ratio",
                  "actual_cumulative ÷ expected_cumulative. 1.0 = perfectly on pace. > 1.0 = running ahead. < 1.0 = running behind.",
                ],
                [
                  "Projected EOM",
                  "An extrapolation of the current daily burn rate to the end of the month. Used to determine alert level.",
                ],
                [
                  "Expected cumulative",
                  "The straight-line target: pool_hours × (days_elapsed ÷ days_in_month). Reaches pool on the last day.",
                ],
                [
                  "Hard buffer",
                  "Capacity withheld from client work (default 15%). Covers overhead, internal ceremonies, and scope surprises.",
                ],
                [
                  "Net gap hours",
                  "Spare capacity after buffer and committed hours. Negative = understaffed.",
                ],
                [
                  "Jira component",
                  "The Jira issue component used to tag worklogs to a client (NA).",
                ],
                [
                  "Unmapped ref",
                  "A worklog whose key is not in any mapping table — it is skipped during sync.",
                ],
              ].map(([term, def]) => (
                <TableRow key={term}>
                  <TableCell className="font-semibold whitespace-nowrap">{term}</TableCell>
                  <TableCell className="text-muted-foreground">{def}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Management Dashboard" subtitle="What each tab can create, edit, and delete.">
        <SectionH3>Workforce</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Create</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Delete / Archive</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "Squad Membership",
                  "Yes",
                  "Allocation %, effectiveTo",
                  "Hard delete",
                  "P2002 guard: unique person+squad+effectiveFrom",
                ],
                [
                  "Person Role",
                  "Yes",
                  "Seniority, effectiveTo",
                  "Hard delete",
                  "Role type immutable after creation",
                ],
                [
                  "Squad Capacity Config",
                  "Yes",
                  "hardBufferPct, softBufferPct",
                  "Hard delete",
                  "P2002 guard: unique squad+roleType",
                ],
              ].map(([m, c, e, d, n]) => (
                <TableRow key={m}>
                  <TableCell className="font-semibold">{m}</TableCell>
                  <TableCell>{c}</TableCell>
                  <TableCell>{e}</TableCell>
                  <TableCell>{d}</TableCell>
                  <TableCell className="text-muted-foreground">{n}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SectionH3>Client &amp; Contract</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Create</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Terminal States</TableHead>
                <TableHead>Transitions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "Retainer Contract",
                  "Yes",
                  "poolHours, validTo",
                  "closed → read-only",
                  "active↔paused, any→closed",
                ],
                [
                  "Contract Extension",
                  "Yes",
                  "requestedHours, roleType, rateOverride, notes",
                  "rejected/closed → read-only",
                  "pending_approval→approved or rejected; approved→closed",
                ],
                [
                  "Change Order",
                  "Yes",
                  "notes only",
                  "closed → read-only",
                  "pending_written→pending_docusign→approved→active→closed",
                ],
                [
                  "CO Line Item",
                  "Yes (pre-approval only)",
                  "hours, rateOverride",
                  "Hard delete (pre-approval only)",
                  "Blocked if CO ≥ approved",
                ],
                [
                  "SME Engagement",
                  "Yes",
                  "personId, hours, rates",
                  "closed → read-only",
                  "requested→confirmed→active→closed",
                ],
                [
                  "Monthly Role Declaration",
                  "Yes",
                  "declaredHours, overrideReason",
                  "locked/derived → read-only",
                  "draft→confirmed→locked",
                ],
              ].map(([m, c, e, t, tr]) => (
                <TableRow key={m}>
                  <TableCell className="font-semibold">{m}</TableCell>
                  <TableCell>{c}</TableCell>
                  <TableCell>{e}</TableCell>
                  <TableCell>{t}</TableCell>
                  <TableCell className="text-muted-foreground">{tr}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SectionH3>Billing</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Create</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Delete</TableHead>
                <TableHead>Guard</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "Billing Rate",
                  "Yes",
                  "Immutable after creation",
                  "Yes — guarded",
                  "Blocked if ≥1 HourRecord falls within rate period",
                ],
                [
                  "Cost Rate",
                  "Yes",
                  "Immutable after creation",
                  "Yes — guarded",
                  "Blocked if ≥1 HourRecord falls within rate period",
                ],
                ["TE Billing Config", "Yes", "type, value, currency", "Yes", "Unique per client"],
                [
                  "TE Billing Role Rate",
                  "Yes (via config)",
                  "No edit",
                  "Yes",
                  "Unique per config+roleType",
                ],
                [
                  "Client Person Access",
                  "Yes (Grant)",
                  "No edit",
                  "Revoke only",
                  "revokedAt set; cannot re-revoke",
                ],
              ].map(([m, c, e, d, g]) => (
                <TableRow key={m}>
                  <TableCell className="font-semibold">{m}</TableCell>
                  <TableCell>{c}</TableCell>
                  <TableCell>{e}</TableCell>
                  <TableCell>{d}</TableCell>
                  <TableCell className="text-muted-foreground">{g}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SectionH3>Non-Billable</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Create</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  "NB Category",
                  "Yes",
                  "name, type, description",
                  "Soft-delete (archive) — sets isActive=false",
                ],
                ["NB Source Mapping", "Yes", "No edit", "Hard delete"],
                ["NB Entry", "Read-only", "—", "—"],
              ].map(([m, c, e, d]) => (
                <TableRow key={m}>
                  <TableCell className="font-semibold">{m}</TableCell>
                  <TableCell>{c}</TableCell>
                  <TableCell>{e}</TableCell>
                  <TableCell className="text-muted-foreground">{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SectionH3>Analytics</SectionH3>
        <P>
          Consumption, Burn, Staffing, NB Summaries — all read-only derived data. Anomaly Flags can
          be resolved (requires resolution notes). Enhancement Suggestions support status
          transitions: open→acknowledged→applied or dismissed (terminal).
        </P>
        <SectionH3>Configuration</SectionH3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Write operations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Holiday Calendar", "Full CRUD. Delete cascades entries."],
                ["Holiday Entry", "Full CRUD via calendar entries panel."],
                [
                  "Person Calendar Assignment",
                  "Full CRUD. One open-ended row per person enforced.",
                ],
                [
                  "Role Cascade Rule",
                  "Create + delete. P2002 guard: unique client+fromRole+toRole.",
                ],
              ].map(([m, w]) => (
                <TableRow key={m}>
                  <TableCell className="font-semibold">{m}</TableCell>
                  <TableCell className="text-muted-foreground">{w}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SectionH3>Audit Trail</SectionH3>
        <P>
          Seven read-only panels showing append-only history records: Role Declaration History,
          Contract Amendments, Extension History, Change Order History, Line Item History, SME
          Engagement History, and Sync Logs. No write controls anywhere in the Audit tab.
        </P>
      </Section>
    </div>
  );
}
