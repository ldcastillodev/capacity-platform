# PRD: Managed Services Capacity Management System
**Status**: Draft
**Author**: Alex (Product Manager)
**Last Updated**: 2026-03-19
**Version**: 1.0
**Stakeholders**: Agency Operations Lead, Squad Team Leads, Finance/Billing, Engineering

---

## 1. Problem Statement

A managed services agency with multiple multidisciplinary squads is flying blind on capacity. Each squad supports several clients under a retainer model (buckets of hours per month per role type, no rollover). Roles can be dedicated to one squad or shared across squads. Developers are typed (frontend / backend). People have access-controlled visibility into specific clients only.

The agency has no centralized system to answer the following questions with confidence:

- Is this squad currently over- or under-servicing its clients?
- Which clients are burning their retainer too fast, and which will lose unused hours at month-end?
- If a new client wants to onboard next month, do we have available capacity — or do we need to hire?
- Are there anomalous billing or effort patterns that signal churn risk, scope creep, or team burnout?
- What is the actual margin per squad, per client, and per role type?

The cost of not solving this is direct: margin leakage from untracked hours, churn from over- or under-serviced clients, reactive hiring that lags actual demand, and team burnout from invisible overload.

**Evidence basis (to be validated before dev start):**
- Hypothesis: team leads spend 3-5 hours/week manually consolidating spreadsheets to approximate this information
- Hypothesis: 15-25% of retainer hours are lost to underutilization or untracked overages monthly
- Hypothesis: hiring decisions are made reactively (after capacity pain is felt), not proactively

---

## 2. Goals and Success KPIs

| Goal | Metric | Baseline (estimated) | Target | Window |
|------|--------|---------------------|--------|--------|
| Maximize margin per squad | Gross margin % per squad | Unknown (manual) | Visible + trackable; 5pp improvement in 6 months | 6 months post-launch |
| Reduce retainer waste | % of contracted hours utilized per client/month | Unknown | 85-95% utilization band (not under, not over) | 90 days post-launch |
| Proactive capacity planning | Time from "new client signal" to hire/no-hire recommendation | Weeks (manual) | Under 24 hours | 60 days post-launch |
| Reduce manual overhead | Hours/week spent on capacity admin by team leads | ~4h/week (hypothesis) | Under 30 minutes/week | 60 days post-launch |
| Anomaly detection coverage | % of billing/effort anomalies surfaced before client impact | 0% (reactive today) | 80% detected proactively | 90 days post-launch |
| Team health | Overloaded-role detection lead time | Reactive | 2+ weeks ahead | 90 days post-launch |

---

## 3. Non-Goals (v1)

- This system does not replace time-tracking tools (it integrates with them or accepts CSV/API import).
- It does not generate invoices or handle billing workflows — it informs billing, it does not own it.
- It does not manage HR processes (hiring, onboarding, offboarding).
- It does not enforce access control for client work itself — it enforces visibility permissions within this tool only.
- It does not handle fixed-price or milestone-based contracts in v1 — retainer model only.
- It does not provide a client-facing portal in v1.
- Mobile app is out of scope for MVP.

---

## 4. User Personas

### Persona A: Jordan — Squad Team Lead
Mid-level manager responsible for 1-2 squads, 6-12 people, 4-8 clients. Splits time between client delivery and people management. Currently manages capacity in spreadsheets. Primary pain: reactive fire-fighting when a client is burning hours too fast or a developer is suddenly overloaded.

**Core need**: A single dashboard that tells them, every Monday morning, exactly where each squad stands — no assembly required.

### Persona B: Sam — Agency Operations Lead
Owns resource allocation across all squads. Makes hiring recommendations and handles cross-squad shared roles. Needs the organization-wide view: where is there slack, where is there strain, and what does next quarter look like.

**Core need**: Org-wide capacity visibility with drill-down, and a reliable "do we need to hire" answer when a new client is about to sign.

### Persona C: Riley — Finance/Billing Lead
Owns retainer contract accuracy. Needs to know which clients are under- or over-utilizing their buckets to manage conversations about contract amendments, upsells, or refunds.

**Core need**: Per-client, per-month utilization report that maps directly to contract line items.

---

## 5. Feature List

### MVP (Phase 1) — Must ship to deliver core value

**F1: Role and People Registry**
Define and maintain the roster of people, their role types (frontend dev, backend dev, designer, PM, QA, etc.), their squad assignment(s) (dedicated or shared with split percentage), and their client access list.

**F2: Client and Retainer Contract Registry**
Define and maintain clients, their assigned squad(s), and their monthly retainer buckets per role type (e.g., Client A: 40h frontend dev, 20h PM, 10h QA). Support multiple role buckets per client. Store contract effective dates and version history.

**F3: Hours Ingestion and Mapping**
Accept logged hours (via integration with a time-tracking tool or CSV import). Map each logged entry to: person, role type, client, squad, and month. Hours logged against a client by a person not in that client's access list must be flagged, not silently accepted.

**F4: Monthly Utilization Dashboard (Squad/Client View)**
Per squad and per client, show for the current month:
- Contracted hours per role type
- Hours logged to date
- Hours remaining
- Projected end-of-month utilization (based on burn rate in current period)
- RAG status: Green (70-95% projected utilization), Amber (50-70% or 95-110%), Red (under 50% or over 110%)

**F5: Capacity Availability Calculator**
Given a new hypothetical client with defined retainer buckets per role type, calculate:
- Which squads have sufficient available capacity per role type
- Which roles create a bottleneck
- Whether shared roles are already committed across other squads
- A clear hire / no-hire recommendation per role type with supporting numbers

**F6: Overage and Underutilization Alerts**
Automated alerts (in-app and email digest) triggered when:
- A client is projected to exceed retainer by >10% before month end
- A client is projected to leave >20% of any role bucket unused with fewer than 7 days left in the month
- A person is logged at >110% of available hours in a given month

**F7: Basic Margin Visibility**
For each squad, display a simplified margin view:
- Total contracted retainer value (sum of client retainer fees, manually entered or imported)
- Total logged hours cost (people cost, based on loaded cost rate entered per person — not displayed publicly, visible to Operations Lead and Finance only)
- Implied gross margin %
- Variance vs. prior month

**F8: Role-Based Access Control**
Three access tiers:
- Team Lead: sees their squad(s) and only clients they manage
- Operations Lead: sees all squads, all clients, all margin data
- Finance: sees all utilization and margin data, no people-level drill-down into daily logs

---

### Phase 2 — High-value, validated after MVP

**F9: Historical Trend Analysis (12-month rolling)**
Per squad, per client, per role type: view month-over-month utilization trends. Identify seasonal patterns. Surface clients whose consumption is structurally above or below contract (contract renegotiation signal).

**F10: Anomaly Detection Engine**
Automated pattern analysis that flags:
- Sudden spikes in hours logged to a single client mid-month (scope creep signal)
- Consistent under-logging by a specific person (possible morale/burnout signal or logging discipline issue)
- A role type being systematically over-consumed across multiple clients simultaneously (team under-capacity signal)
- Month-over-month retainer burn rate acceleration above 2 standard deviations

**F11: Staffing Forecast (90-day)**
Based on current retainer contracts, known renewal dates, and pipeline inputs (manually entered by Ops Lead), project capacity demand and available supply per role type for the next 90 days. Output: projected surplus or deficit per role, per squad.

**F12: Cross-Squad Shared Resource Optimizer**
For roles that are shared across squads, surface scheduling conflicts and utilization imbalances. Recommend reallocation if one squad is consistently under-using a shared role while another is constrained.

**F13: Client Health Score**
Composite score per client (visible to Team Lead and Ops Lead) that combines:
- Retainer utilization consistency (is consumption predictable?)
- Overage frequency (are they consistently over-contract?)
- Hours-to-outcomes correlation (if outcomes data is available via integration or manual entry)

**F14: Time-Tracking Tool Integration (native connector)**
Native read-only integration with at least one major time-tracking tool (e.g., Harvest, Toggl, Clockify) to eliminate manual CSV imports. Authentication per person, scoped to their accessible clients only.

---

## 6. User Stories with Acceptance Criteria

### Story 1 (F4): Monday Morning Squad Review
As Jordan (Team Lead), I want to open the app on Monday and immediately see which of my clients are on track, at risk, or in danger of unused hours this month, so that I can take action before it is too late.

**Acceptance Criteria:**
- Given I log in as a Team Lead, when I land on the dashboard, then I see only the squads and clients I am assigned to manage
- Given the current month has 7 or fewer business days remaining, when a client has projected utilization under 70% for any role bucket, then an Amber or Red indicator is shown with the specific role type and projected unused hours
- Given a client's projected utilization exceeds 100% for any role bucket, then a Red indicator shows the role type, projected overage in hours, and the overage as a % of contract
- Given I click on any client row, then I see the per-role-type breakdown with logged hours, remaining hours, and projection
- Dashboard load time is under 2 seconds for squads with up to 20 people and 10 clients

---

### Story 2 (F5): New Client Capacity Check
As Sam (Operations Lead), I want to enter a proposed retainer for a new client and immediately see whether we have capacity to absorb it — and if not, exactly which roles we are short on — so that I can answer the client and the sales team within hours, not days.

**Acceptance Criteria:**
- Given I input a proposed client retainer (role type + hours/month), when I run the capacity check, then the system returns a per-role-type verdict: Available / Constrained / Requires Hire
- Given a role is Constrained, then the output shows current committed hours, available hours, and the delta
- Given a role Requires Hire, then the output states the minimum FTE-equivalent needed based on standard working hours
- Given shared roles are involved, then the check accounts for their existing commitments across all squads
- The capacity check must process within 3 seconds

---

### Story 3 (F6): Overage Alert Before Month End
As Jordan (Team Lead), I want to be alerted when a client is burning hours faster than their retainer allows, before they actually exceed it, so that I can have a conversation with the client or adjust resourcing proactively.

**Acceptance Criteria:**
- Given a client's 7-day rolling burn rate projects to exceed their contracted hours before month end, when the projection crosses the 100% threshold, then an alert is triggered
- Given the alert triggers, then it is surfaced in-app as a banner on the relevant client row AND delivered via email digest within 4 hours
- Given I acknowledge the alert, then it is marked acknowledged and does not re-trigger until the next business day unless projection worsens by >5%
- Alerts are scoped to the Team Lead's assigned clients only

---

### Story 4 (F7): Margin Review
As Sam (Operations Lead), I want to see the gross margin per squad for the current and prior month, so that I can identify which squads are most profitable and which are at risk.

**Acceptance Criteria:**
- Given I am logged in as Operations Lead, when I view the Margin dashboard, then I see gross margin % per squad for the current month and prior 3 months
- Given a squad's gross margin falls below a configurable warning threshold (default: 40%), then the squad row is flagged Amber
- Given a squad's gross margin falls below a configurable critical threshold (default: 25%), then the squad row is flagged Red
- Loaded cost rates per person are visible only to Operations Lead and Finance roles, not Team Leads
- Margin data is recalculated on each page load, reflecting latest logged hours

---

### Story 5 (F3): Hours Ingestion with Access Validation
As an Operations Lead, I want hours logged by team members to be automatically validated against each person's client access list before being accepted, so that I do not have mis-attributed hours distorting client utilization reports.

**Acceptance Criteria:**
- Given a time log entry is imported or submitted for a person against a client, when that person does not have access to that client, then the entry is rejected and surfaced in a flagged exceptions queue
- Given an entry is rejected, then the submitting person and their Team Lead receive a notification with the specific entry and reason
- Given all entries in an import batch are valid, then they are processed and reflected in utilization data within 5 minutes of ingestion
- The exceptions queue is visible to Operations Lead and Team Leads (scoped to their squad)

---

## 7. Key Metrics the System Must Track and Surface

### Utilization Metrics (per client, per role type, per month)
- Contracted hours
- Hours logged to date
- Hours remaining
- Daily average burn rate (rolling 7 days)
- Projected end-of-month utilization %
- Actual end-of-month utilization % (historical)
- Overage hours (when actual > contracted)
- Unused hours (when actual < contracted at month close)

### Capacity Metrics (per squad, per role type)
- Total available hours per role type per month (derived from people assigned, accounting for PTO or holidays if entered)
- Total committed hours per role type per month (sum of contracted retainers)
- Available headroom per role type (available minus committed)
- Commitment ratio: committed / available (flag if >85%)
- Shared role utilization split across squads

### People Metrics (per person)
- Logged hours per month vs. expected hours (based on FTE status)
- Utilization rate: logged client hours / available working hours
- Cross-squad load (for shared roles): hours split across squads
- Client access list (for audit and access validation)

### Margin Metrics (per squad, per client)
- Contracted retainer revenue per month
- Implied cost of logged hours (logged hours x loaded cost rate per person)
- Gross margin % = (revenue - cost) / revenue
- Margin trend: month-over-month delta
- Margin at risk: projected end-of-month margin based on current burn trajectory

### Anomaly Signals (Phase 2, tracked from day 1 for retroactive analysis)
- Client burn rate acceleration: week-over-week change in daily burn rate
- Person logging gaps: days with zero logs for an active person (configurable threshold)
- Role over-commitment: role type where commitment ratio exceeds 90% across squads simultaneously
- Retainer fit score: rolling 3-month average of actual vs. contracted (signals contracts that need renegotiation)

---

## 8. Main User Flows (Team Lead Perspective)

### Flow 1: Weekly Capacity Review (Monday Ritual)
1. Team Lead logs in. Landing page is the Squad Dashboard for their assigned squads.
2. Dashboard shows current month utilization status per client per role type in a grid (RAG color coding).
3. Team Lead scans for Amber and Red indicators.
4. For each flagged client, they click through to the Client Detail view.
5. Client Detail view shows: role-type breakdown, daily log history for the month, 7-day burn rate, projected end-of-month.
6. Team Lead uses the "Flag for action" function to add a note and assign a follow-up to themselves or another lead.
7. Weekly summary report (generated automatically, delivered via email Monday 8am) reflects all Amber/Red clients and any alerts from the prior week.

### Flow 2: New Client Onboarding Capacity Check
1. Sales or Ops notifies Team Lead of a prospective client with proposed retainer terms.
2. Team Lead (or Ops Lead) navigates to Capacity Planner.
3. Enters proposed retainer: role types and hours per month.
4. Selects the target squad (or leaves as "any squad" for org-wide check).
5. System returns a capacity verdict grid: per role type, Available / Constrained / Requires Hire with supporting numbers.
6. If Constrained: system shows which existing clients are consuming the conflicting capacity and how much headroom exists.
7. If Requires Hire: system outputs minimum hours needed and equivalent FTE fraction.
8. Team Lead copies or exports the summary to share with Ops Lead or sales team.
9. If approved, Team Lead adds the new client to the registry and their retainer contract is activated for the next month cycle.

### Flow 3: Mid-Month Overage Intervention
1. Team Lead receives an in-app alert or email notification: "Client X is projected to exceed frontend dev retainer by 12 hours by month end."
2. Team Lead clicks into the alert, which opens the Client Detail view pre-filtered to the overage role.
3. They review which team members are logging to the client and the recent daily log pattern.
4. Team Lead chooses one of three actions:
   a. Reallocate: reassign or throttle hours toward the client for the remainder of the month.
   b. Flag for client conversation: mark the overage as a scope discussion needed; alert is escalated to Ops Lead.
   c. Approve overage: acknowledge that this month will run over contract; a note is attached for billing review.
5. The chosen action is logged against the alert for audit trail.
6. If "Flag for client conversation" is chosen, the Ops Lead receives a notification with the overage detail and context note.

### Flow 4: Month-End Utilization Close
1. On the last business day of the month, the system automatically generates a Month-End Utilization Report per squad.
2. Report shows: per client, per role type — contracted hours, actual hours, variance, unused hours (lost), overage hours (potentially billable).
3. Team Lead reviews and marks the report as reviewed.
4. Finance Lead receives the same report automatically.
5. Any client with >25% unused hours in any role bucket is flagged as a "contract fit review" candidate for the following month.
6. Historical data is locked for the closed month. No edits to logged hours are permitted after the 3rd business day of the following month without an Operations Lead override with a documented reason.

### Flow 5: Person Capacity and Overload Check
1. Team Lead navigates to the People view (scoped to their squad).
2. They see each person's current month: total available hours, logged hours to date, utilization %, client-by-client breakdown.
3. Any person at >100% utilization is shown in Red. Any person below 60% utilization is shown in Amber (potential underutilization or logging discipline issue).
4. For overloaded people, Team Lead can drill down to see which clients are consuming hours and identify if any can be deferred, reassigned, or renegotiated.
5. For shared-role people, the view also shows how their hours are split across squads and flags if the cross-squad total exceeds 100%.

---

## 9. Technical Considerations

### Dependencies
- Time-tracking integration (MVP can be CSV import; Phase 2 requires native connector) — owner: Engineering Lead
- Authentication and RBAC system — must support the three-tier access model from day one
- Contract/retainer data must be versionable — changes mid-month must not retroactively alter prior period reports

### Known Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Inconsistent time-logging hygiene degrades data quality | High | High | Build exceptions queue (F3); require weekly log completion as a process norm, not just a system feature |
| Loaded cost rates are politically sensitive — finance may resist entering them | Medium | High | Make cost rates optional at MVP; degrade gracefully to utilization-only if rates not entered |
| Shared role accounting is complex — same person in multiple squads creates double-count risk | Medium | High | Model person-hours as a shared pool from day one; do not model per-squad independently |
| Month boundary calculations differ across time zones for distributed teams | Low | Medium | Standardize all month calculations on agency HQ time zone; document this clearly |

### Open Questions (must resolve before dev start)
- [ ] What time-tracking tool(s) are currently in use, and what export format is available? — Owner: Ops Lead — Deadline: before Phase 1 scoping
- [ ] How is "loaded cost rate" currently calculated — is it a flat rate per role type or per individual? — Owner: Finance Lead — Deadline: before F7 design
- [ ] Are PTO and public holidays tracked centrally, or do we default to standard working-days-per-month? — Owner: Ops Lead — Deadline: before F5 design
- [ ] What is the source of truth for client retainer contract values — CRM, spreadsheet, or billing tool? — Owner: Finance Lead — Deadline: before F2 design
- [ ] How are partial-month starts handled for new clients or new hires? — Owner: Ops Lead — Deadline: before F2 design

---

## 10. MVP vs Phase 2 Prioritization

### MVP (Phase 1) — Target: 8-10 weeks of product + engineering work

| Feature | Rationale for MVP inclusion |
|---------|----------------------------|
| F1: Role and People Registry | Foundation for everything; zero value without it |
| F2: Client and Retainer Contract Registry | Foundation for utilization calculations |
| F3: Hours Ingestion and Mapping | Core data pipeline; CSV import acceptable for MVP |
| F4: Monthly Utilization Dashboard | Primary team lead use case; highest daily-use value |
| F5: Capacity Availability Calculator | Directly answers the "do we hire" question; high ops value |
| F6: Overage and Underutilization Alerts | Prevents margin leakage and client relationship damage |
| F7: Basic Margin Visibility | Finance and ops need this to justify the system's existence |
| F8: Role-Based Access Control | Non-negotiable on day one given multi-squad, multi-client sensitivity |

### Phase 2 — Target: following 8-12 weeks, after 60-day MVP validation

| Feature | Rationale for Phase 2 |
|---------|----------------------|
| F9: Historical Trend Analysis | Requires 2-3 months of data to be meaningful |
| F10: Anomaly Detection Engine | Requires baseline data; premature without historical patterns |
| F11: Staffing Forecast (90-day) | Complex; requires pipeline integration; validate demand first |
| F12: Cross-Squad Shared Resource Optimizer | Edge case complexity; validate base case first |
| F13: Client Health Score | Composite scoring requires calibration against observed outcomes |
| F14: Native Time-Tracking Integration | CSV import validates the workflow; native connector reduces friction after PMF |

---

## 11. Launch Plan (MVP)

| Phase | Date | Audience | Success Gate |
|-------|------|----------|-------------|
| Internal alpha | Week 8 | 1 squad (pilot team), Ops Lead, Finance Lead | Core flows complete, no data loss bugs, all P0 acceptance criteria pass |
| Closed beta | Week 10 | All team leads (read-only on live data) | Less than 5% error rate on hours ingestion, team lead feedback CSAT >= 4/5 |
| Full rollout | Week 12 | All squads and roles | Utilization dashboard used weekly by 80% of team leads within 30 days |

**Rollback criteria**: If hours ingestion produces calculation errors affecting more than one squad, or if RBAC allows cross-squad data leakage in any test, revert to prior version and page engineering lead.

---

## 12. Appendix

- [ ] User interview guide for team leads (to validate problem hypotheses before dev start)
- [ ] Sample retainer contract structure (for F2 data model design)
- [ ] Current spreadsheet template (baseline for data migration and field mapping)
- [ ] Analytics requirements for Phase 2 anomaly detection (to be written after MVP ships)
- [ ] Competitive landscape note: existing tools (Float, Resource Guru, Teamdeck) were evaluated — primary gap is retainer-model specificity and cross-squad shared-role accounting
