"use client";

import type React from "react";

const sectionStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "24px 28px",
  marginBottom: 24,
};

const h2Style: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  marginBottom: 4,
  color: "var(--text)",
};

const h3Style: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 6,
  marginTop: 20,
  color: "var(--text)",
};

const pStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--text-muted)",
  lineHeight: 1.7,
  marginBottom: 10,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  marginBottom: 18,
};

const formulaBox: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 16px",
  fontFamily: "monospace",
  fontSize: 13,
  color: "var(--text)",
  lineHeight: 1.8,
  marginBottom: 12,
};

const tagStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 99,
  fontSize: 12,
  fontWeight: 700,
  background: color + "22",
  color: color,
  marginRight: 6,
});

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  marginBottom: 8,
};

const thCell: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg)",
};

const tdCell: React.CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
  lineHeight: 1.5,
};

const dividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border)",
  margin: "18px 0",
};

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>How to Use</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 14 }}>
          Rules, thresholds, and logic behind every number in this platform.
        </p>
      </div>

      {/* 1. Alert Levels */}
      <div style={sectionStyle}>
        <div style={h2Style}>Alert Levels</div>
        <p style={subtitleStyle}>Used on Overview, Burn Rate, and Anomaly Flags.</p>

        <p style={pStyle}>
          Every client receives one of four alert levels, recalculated each time the burn
          snapshot job runs (daily at 02:30, or on-demand). The level is driven by two
          independent checks — whichever is more severe wins.
        </p>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Level</th>
              <th style={thCell}>Overburn condition</th>
              <th style={thCell}>Underburn condition</th>
              <th style={thCell}>What it means</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                level: "Safe",
                color: "var(--safe)",
                over: "Proj. EOM ≤ 95% of pool",
                under: "Burn ratio ≥ 60%",
                desc: "Consuming hours at a healthy pace. No action needed.",
              },
              {
                level: "Watch",
                color: "var(--watch)",
                over: "Proj. EOM > 95% of pool",
                under: "Burn ratio < 60%",
                desc: "Slightly ahead of pace or underutilising. Worth monitoring.",
              },
              {
                level: "Warning",
                color: "var(--warning)",
                over: "Proj. EOM > 100% of pool",
                under: "Burn ratio < 40%",
                desc: "Overrun likely, or significantly below pace. Needs attention.",
              },
              {
                level: "Critical",
                color: "var(--critical)",
                over: "Proj. EOM > 110% of pool",
                under: "Burn ratio < 20%",
                desc: "Overrun almost certain, or near-zero activity. Act now.",
              },
            ].map(({ level, color, over, under, desc }, i) => (
              <tr key={level} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={tdCell}>
                  <span style={tagStyle(color)}>{level}</span>
                </td>
                <td style={tdCell}>{over}</td>
                <td style={tdCell}>{under}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ ...pStyle, marginTop: 12 }}>
          A client gets the <strong>worst</strong> level triggered by either condition. For
          example, a client with a burn ratio of 15% (underburn → Critical) but a projected
          EOM within pool would still be flagged Critical.
        </p>
      </div>

      {/* 2. Burn Rate */}
      <div style={sectionStyle}>
        <div style={h2Style}>Burn Rate</div>
        <p style={subtitleStyle}>
          The Burn Rate page and the burn_rate_ratio metric on Overview.
        </p>

        <p style={pStyle}>
          Burn rate measures how fast a client is consuming their monthly hour pool
          compared to an idealised straight-line pace. It is recalculated weekly (every
          Monday) and backfilled for all prior weeks of the current month.
        </p>

        <div style={h3Style}>Key formulas</div>
        <div style={formulaBox}>
          <div><strong>Expected pace (at any point in month)</strong></div>
          <div>expected_cumulative = pool_hours × (calendar_days_elapsed ÷ calendar_days_in_month)</div>
          <br />
          <div><strong>Burn ratio</strong></div>
          <div>burn_rate_ratio = actual_cumulative_hours ÷ expected_cumulative</div>
          <br />
          <div><strong>Projected end-of-month</strong></div>
          <div>projected_eom = (hours_to_date ÷ days_elapsed) × days_in_month</div>
        </div>

        <p style={pStyle}>
          <strong>Expected pace</strong> uses calendar days for both numerator and
          denominator, so it rises linearly from 0 on day 1 to exactly the pool limit
          on the last day of the month — it will never exceed the pool line on the chart.
        </p>

        <p style={pStyle}>
          <strong>Projected EOM</strong> extrapolates today&apos;s daily average to the full
          month. If a client consumed 60 h in the first 10 days of a 31-day month, the
          projected EOM = (60 ÷ 10) × 31 = 186 h.
        </p>

        <hr style={dividerStyle} />

        <div style={h3Style}>Reading the Burn Rate chart</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Line</th>
              <th style={thCell}>What it shows</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "var(--surface)" }}>
              <td style={tdCell}><strong style={{ color: "var(--primary)" }}>Actual</strong> (solid)</td>
              <td style={tdCell}>Cumulative hours logged from the 1st of the month to the end of each week.</td>
            </tr>
            <tr style={{ background: "var(--bg)" }}>
              <td style={tdCell}><strong style={{ color: "var(--text-muted)" }}>Expected pace</strong> (dashed)</td>
              <td style={tdCell}>The straight-line target. If actual tracks this line, the client will consume exactly their pool by month-end.</td>
            </tr>
            <tr style={{ background: "var(--surface)" }}>
              <td style={tdCell}><strong style={{ color: "var(--critical)" }}>Pool limit</strong> (red dashed)</td>
              <td style={tdCell}>The client&apos;s contracted pool hours for the month. The actual line crossing this means overburn.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. Hours Consumption */}
      <div style={sectionStyle}>
        <div style={h2Style}>Hours Consumption</div>
        <p style={subtitleStyle}>The Consumption page — declared vs actual utilisation.</p>

        <p style={pStyle}>
          Consumption is a point-in-time snapshot: how many hours have been logged
          against a client&apos;s <strong>declared</strong> allocation this month, expressed
          as a percentage.
        </p>

        <div style={formulaBox}>
          utilisation % = consumed_hours ÷ declared_hours × 100
        </div>

        <p style={pStyle}>
          <strong>Declared hours</strong> come from the Monthly Role Declaration — the
          hours allocated per role per client for that month. They are <em>not</em> the
          same as the retainer pool (which is the overall contractual cap). A client can
          have declared hours that add up to less than its pool.
        </p>

        <div style={h3Style}>Why Consumption and Overview can differ</div>
        <p style={pStyle}>
          Overview uses <strong>burn rate</strong> (time-adjusted pace) while Consumption
          shows <strong>raw utilisation</strong> (no time context). A client at 97%
          utilisation with 75% of the month elapsed is on pace for a 129% overrun by
          month-end — correctly flagged Critical on Overview, but looking almost green on
          Consumption. Both views are correct; they answer different questions:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Page</th>
              <th style={thCell}>Question answered</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "var(--surface)" }}>
              <td style={tdCell}><strong>Overview / Burn Rate</strong></td>
              <td style={tdCell}>Will this client overrun their pool by month-end if the current pace continues?</td>
            </tr>
            <tr style={{ background: "var(--bg)" }}>
              <td style={tdCell}><strong>Consumption</strong></td>
              <td style={tdCell}>How much of the declared allocation has been used so far?</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. Anomaly Flags */}
      <div style={sectionStyle}>
        <div style={h2Style}>Anomaly Flags</div>
        <p style={subtitleStyle}>Auto-generated warnings that need a human decision.</p>

        <p style={pStyle}>
          Flags are created by the nightly analytics job when a rule-based condition is
          met. They remain open until someone resolves them with a note. A flag is
          per-client per-month — the same issue will not re-fire if it is already open.
        </p>

        <div style={h3Style}>Flag types</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Type</th>
              <th style={thCell}>Trigger</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                type: "Overburn",
                rule: "Projected EOM > 105% of pool. Fires as Warning; escalates to Critical at > 115%.",
              },
              {
                type: "Underburn",
                rule: "Projected EOM < 50% of pool and we are past mid-month. Suggests under-staffing or missing timesheets.",
              },
              {
                type: "Zero hours",
                rule: "No hours logged at all past week 2 of the month. Likely a missing Tempo mapping or timesheet gap.",
              },
              {
                type: "Spike",
                rule: "A single week's hours are more than 2× the prior-week average. Could indicate back-dated entries or a genuine effort spike.",
              },
            ].map(({ type, rule }, i) => (
              <tr key={type} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600, whiteSpace: "nowrap" }}>{type}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{rule}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={pStyle}>
          To dismiss a flag without taking action, open it and enter a resolution note
          (e.g. &quot;Client approved additional scope&quot;). Resolved flags are kept for audit
          history but disappear from the open count.
        </p>
      </div>

      {/* 5. Non-Billable */}
      <div style={sectionStyle}>
        <div style={h2Style}>Non-Billable Hours</div>
        <p style={subtitleStyle}>Internal time that doesn&apos;t count toward client pools.</p>

        <p style={pStyle}>
          A worklog is classified as non-billable when it is logged against a Jira
          ticket whose <strong>Tempo account key</strong> appears in the non-billable
          key list (e.g. <code>CAAS-HN-NB</code>, <code>CAAS-WS-NB</code>), or when
          the ticket belongs to an internal Jira project (LC-*).
        </p>

        <div style={h3Style}>Utilisation thresholds</div>
        <div style={formulaBox}>
          nonbillable_pct = non_billable_hours ÷ total_logged_hours × 100
        </div>
        <p style={pStyle}>
          The Non-Billable page surfaces individuals or squads whose non-billable
          percentage is unusually high. Enhancement suggestions are raised automatically
          when a person exceeds 30% non-billable in a month.
        </p>

        <div style={h3Style}>Shared Ceremonies vs Apply General (company)</div>
        <p style={pStyle}>
          <strong>Shared Ceremonies</strong> are distributed to clients at month-end based on each
          person&apos;s proportion of logged billable hours. A person working 60% on Client A
          and 40% on Client B will have 60%/40% of their ceremony time attributed to
          each client respectively. This allocation is visible in the Ceremonies column
          on the Consumption page.
        </p>
        <p style={pStyle}>
          <strong>Apply General</strong> (company type) covers company-wide overhead that is NOT
          attributed to any client: disciplinary meetings, company events, recruitment,
          and internal Apply team activities (including NA Apply hours — MP-2980). These
          hours are tracked for cost awareness but do not reduce any client&apos;s remaining
          pool.
        </p>

        <div style={h3Style}>Enhancement suggestion statuses</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Status</th>
              <th style={thCell}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {[
              { s: "Open", m: "Newly raised — not yet reviewed." },
              { s: "In Review", m: "Someone is investigating the root cause." },
              { s: "Applied", m: "Action taken (e.g. reclassified hours, updated scope)." },
              { s: "Dismissed", m: "Reviewed and accepted as normal (e.g. onboarding week)." },
            ].map(({ s, m }, i) => (
              <tr key={s} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600 }}>{s}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. Staffing Gaps */}
      <div style={sectionStyle}>
        <div style={h2Style}>Staffing Gaps</div>
        <p style={subtitleStyle}>Available capacity vs committed hours per role.</p>

        <p style={pStyle}>
          A staffing gap snapshot compares the hours a squad has available in a given
          role against the hours already committed to active client contracts.
        </p>

        <div style={formulaBox}>
          net_gap_hours = total_available_hours × (1 − hard_buffer_pct) − committed_hours
          <br />
          is_understaffed = net_gap_hours &lt; 0
        </div>

        <p style={pStyle}>
          <strong>Hard buffer</strong> defaults to 15% — capacity reserved for
          overhead, internal work, and unexpected scope changes. It can be overridden
          per squad in the capacity config.
        </p>

        <p style={pStyle}>
          A positive net gap means the squad can absorb more work in that role. A
          negative gap (understaffed) is surfaced in the Overview stat card and will
          block the New Client Simulator from marking a role as &quot;available&quot;.
        </p>
      </div>

      {/* 7. New Client Simulator */}
      <div style={sectionStyle}>
        <div style={h2Style}>New Client Simulator</div>
        <p style={subtitleStyle}>
          &quot;Can we take on this client without hiring?&quot; — answered before you commit.
        </p>

        <p style={pStyle}>
          Enter the proposed client name, start month, total pool hours, and a breakdown
          of hours needed per role. The simulator checks current staffing gap snapshots
          and returns a feasibility verdict for each role.
        </p>

        <div style={h3Style}>Action codes</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Action</th>
              <th style={thCell}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                a: "Available",
                m: "Enough spare capacity in that role. No hiring needed.",
              },
              {
                a: "Redistribute",
                m: "Small shortfall (< 0.5 FTE). Rebalancing existing allocations should cover it.",
              },
              {
                a: "Hire needed",
                m: "Shortfall ≥ 0.5 FTE. Headcount addition required to deliver safely.",
              },
            ].map(({ a, m }, i) => (
              <tr key={a} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600 }}>{a}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{m}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={pStyle}>
          FTE estimates assume <strong>160 billable hours/month per FTE</strong>. All
          simulations are saved for audit — you can see who ran what scenario and when.
        </p>
      </div>

      {/* 8. Data Sources & Sync */}
      <div style={sectionStyle}>
        <div style={h2Style}>Data Sources &amp; Sync</div>
        <p style={subtitleStyle}>Where hours come from and how they are routed.</p>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Region</th>
              <th style={thCell}>Source</th>
              <th style={thCell}>Routing key</th>
              <th style={thCell}>Sync schedule</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "var(--surface)" }}>
              <td style={tdCell}><strong>EMEA</strong></td>
              <td style={tdCell}>Tempo (e2x.atlassian.net)</td>
              <td style={tdCell}>Tempo account key (e.g. <code>CAAS-WS-DEL</code>)</td>
              <td style={tdCell}>Full sync daily at 02:00; delta every hour</td>
            </tr>
            <tr style={{ background: "var(--bg)" }}>
              <td style={tdCell}><strong>NA</strong></td>
              <td style={tdCell}>Jira native worklogs (applydigital.atlassian.net)</td>
              <td style={tdCell}>Jira issue component (e.g. <code>Andertons</code>)</td>
              <td style={tdCell}>Full sync daily at 02:00; delta every hour</td>
            </tr>
          </tbody>
        </table>

        <div style={h3Style}>What happens to unmapped worklogs?</div>
        <p style={pStyle}>
          If a worklog&apos;s account key or component is not in the mapping table, it is
          skipped and the key is recorded in the <code>sync_logs.unmapped_refs</code>
          field of that sync run. Check <strong>Admin → Sync Logs</strong> (or the API
          at <code>/api/v1/sync-logs</code>) to see what&apos;s falling through. Add the
          missing key to the mapping table and run a full sync to retroactively pick up
          the hours.
        </p>

        <div style={h3Style}>Non-billable routing</div>
        <p style={pStyle}>
          A worklog is routed to non-billable (instead of a client) when its account key
          ends in <code>-NB</code>, matches a key in the non-billable source mapping
          table, or belongs to an LC-prefixed internal project. The person&apos;s squad at
          the time of the worklog (not today) determines which squad the non-billable
          entry is attributed to — important for leavers.
        </p>
      </div>

      {/* 9. Month-Specific Contracts */}
      <div style={sectionStyle}>
        <div style={h2Style}>Month-Specific Contracts</div>
        <p style={subtitleStyle}>How to set different pool hours for a single month.</p>

        <p style={pStyle}>
          Retainer contracts have a <code>valid_from</code> and <code>valid_to</code>{" "}
          date. To apply a different pool for one month only, create a contract row with
          that month&apos;s first and last day and a second row starting the following month
          with the normal value. The system always uses the contract whose date range
          covers the first day of the month being queried.
        </p>

        <p style={{ ...pStyle, fontStyle: "italic" }}>
          Example: White Stuff had 468 h in March and 794 h from April onwards — two
          separate contract rows handle this, one with{" "}
          <code>valid_to = 2026-03-31</code> and one with{" "}
          <code>valid_from = 2026-04-01</code>.
        </p>
      </div>

      {/* 10. Refresh Schedule */}
      <div style={sectionStyle}>
        <div style={h2Style}>Refresh Schedule</div>
        <p style={subtitleStyle}>When numbers update automatically.</p>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Job</th>
              <th style={thCell}>Schedule</th>
              <th style={thCell}>What it updates</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                job: "Full sync",
                sched: "Daily at 02:00",
                what: "Fetches all worklogs from Tempo and Jira NA for the current and prior month.",
              },
              {
                job: "Delta sync",
                sched: "Every hour",
                what: "Fetches worklogs modified in the last 2 days only — keeps hours current throughout the day.",
              },
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
            ].map(({ job, sched, what }, i) => (
              <tr key={job} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600, whiteSpace: "nowrap" }}>{job}</td>
                <td style={{ ...tdCell, whiteSpace: "nowrap", color: "var(--text-muted)" }}>{sched}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={pStyle}>
          Any job can be triggered immediately via <strong>Admin → Jobs</strong> in the
          API docs (<code>POST /api/v1/admin/jobs/all</code> runs everything in sequence).
          Use this after manually correcting contracts, mappings, or declared hours so
          the dashboards reflect the change without waiting for the overnight run.
        </p>
      </div>

      {/* 11. Client-Approved T&E Extensions */}
      <div style={sectionStyle}>
        <div style={h2Style}>Client-Approved T&amp;E Extensions</div>
        <p style={pStyle}>
          Sometimes a client approves additional hours beyond their monthly retainer — for a
          sprint overrun, an urgent deliverable, or a change in scope. These are called{" "}
          <strong>T&amp;E (Time &amp; Expense) extensions</strong> and they behave differently
          from regular overburn:
        </p>
        <ul style={{ ...pStyle, paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>They are pre-approved by the client</strong>, so they should not trigger
            CRITICAL or WARNING alerts against the base retainer pool.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>The extra hours are billable</strong> at the T&amp;E rate and count as
            additional revenue for the month — they are tracked separately from retainer revenue.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>The effective pool expands</strong>: once an extension is approved, the{" "}
            <em>Remaining</em> column on the Consumption page increases and utilization % is
            recalculated against the combined pool (retainer + T&amp;E).
          </li>
        </ul>

        <div style={h3Style}>How to register an extension</div>
        <ol style={{ ...pStyle, paddingLeft: 20, marginTop: 4 }}>
          <li style={{ marginBottom: 4 }}>Go to <strong>Consumption</strong> in the sidebar.</li>
          <li style={{ marginBottom: 4 }}>
            Scroll to <strong>Client-Approved T&amp;E Extensions</strong> at the bottom of the page.
          </li>
          <li style={{ marginBottom: 4 }}>
            Find the client row and click <strong>Add T&amp;E</strong>.
          </li>
          <li style={{ marginBottom: 4 }}>
            Fill in the month, the number of approved extra hours, and optionally the role type
            (if the approval covers a specific role) and a note.
          </li>
          <li style={{ marginBottom: 4 }}>
            Click <strong>Save</strong>. The extension is saved with status{" "}
            <em>Approved</em> immediately. The consumption table updates in place.
          </li>
        </ol>

        <div style={h3Style}>Statuses</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Status</th>
              <th style={thCell}>Meaning</th>
              <th style={thCell}>Effect on pool</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Pending approval",
                "Extension has been logged but not yet confirmed by the client.",
                "Does NOT expand the pool yet. Alerts remain in place.",
              ],
              [
                "Approved",
                "Client has confirmed the extra hours. Saved via the form with status=approved.",
                "Pool expands immediately. Utilization % is recalculated. CRITICAL/WARNING risk removed for these hours.",
              ],
            ].map(([status, meaning, effect], i) => (
              <tr key={status} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600, whiteSpace: "nowrap" }}>{status}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{meaning}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ ...pStyle, marginTop: 12 }}>
          <strong>Note:</strong> T&amp;E extensions are month-specific. An approval for March does
          not carry over to April. You must register a new extension each month if the client
          continues to approve additional hours.
        </p>
      </div>

      {/* 12. Glossary */}
      <div style={sectionStyle}>
        <div style={h2Style}>Glossary</div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thCell}>Term</th>
              <th style={thCell}>Definition</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Pool hours", "The total contracted hours for a client in a given month (from the retainer contract)."],
              ["Declared hours", "Hours allocated per role per client for a month (from the Monthly Role Declaration). Used in the Consumption page."],
              ["Burn ratio", "actual_cumulative ÷ expected_cumulative. 1.0 = perfectly on pace. > 1.0 = running ahead. < 1.0 = running behind."],
              ["Projected EOM", "An extrapolation of the current daily burn rate to the end of the month. Used to determine alert level."],
              ["Expected cumulative", "The straight-line target: pool_hours × (days_elapsed ÷ days_in_month). Reaches pool on the last day."],
              ["Hard buffer", "Capacity withheld from client work (default 15%). Covers overhead, internal ceremonies, and scope surprises."],
              ["Net gap hours", "Spare capacity after buffer and committed hours. Negative = understaffed."],
              ["Tempo account key", "The identifier used in Tempo to tag worklogs to a client (EMEA). Format: CAAS-XXX-YYY."],
              ["Jira component", "The Jira issue component used to tag worklogs to a client (NA)."],
              ["Unmapped ref", "A worklog whose key is not in any mapping table — it is skipped during sync."],
            ].map(([term, def], i) => (
              <tr key={term} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                <td style={{ ...tdCell, fontWeight: 600, whiteSpace: "nowrap" }}>{term}</td>
                <td style={{ ...tdCell, color: "var(--text-muted)" }}>{def}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
