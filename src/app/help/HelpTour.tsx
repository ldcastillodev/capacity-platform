"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Body({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function List({ items, ordered }: { items: React.ReactNode[]; ordered?: boolean }) {
  const cls = "space-y-1 pl-5 " + (ordered ? "list-decimal" : "list-disc");
  return ordered ? (
    <ol className={cls}>
      {items.map((t, n) => (
        <li key={n}>{t}</li>
      ))}
    </ol>
  ) : (
    <ul className={cls}>
      {items.map((t, n) => (
        <li key={n}>{t}</li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
      {children}
    </p>
  );
}

type Slide = {
  title: string;
  description: string;
  body: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    title: "Welcome to the MgS Capacity Platform",
    description: "A quick tour of every page and the core admin workflows.",
    body: (
      <Body>
        <p>
          This platform tracks squad capacity, retainer and contract burn, non-billable hours, and
          monthly role declarations across client squads — using hours synced from Jira.
        </p>
        <p>
          Use the <span className="font-medium text-foreground">Back</span> and{" "}
          <span className="font-medium text-foreground">Next</span> arrows (or the dots) to move
          through the tour. Each slide covers one page or workflow. Close anytime with{" "}
          <span className="font-medium text-foreground">Esc</span> or the ✕.
        </p>
      </Body>
    ),
  },
  {
    title: "Overview",
    description: "Delivery health at a glance for the selected month.",
    body: (
      <Body>
        <p>
          The dashboard shows contract-health counts (On Track, Underconsumption, Watch, Critical),
          open flags, active contracts, person and squad totals, and a per-contract consumption
          breakdown.
        </p>
        <List
          items={[
            "Navigate between months.",
            "On a fresh install with no active clients, a Getting Started checklist appears.",
          ]}
        />
        <Note>Health counts only populate once contracts have logged hours for the month.</Note>
      </Body>
    ),
  },
  {
    title: "Burn Rate",
    description: "Weekly cumulative burn per active contract.",
    body: (
      <Body>
        <p>
          Each contract charts actual cumulative hours against the expected pace, with a pool-limit
          reference line and a pace alert (On Pace, Behind, Ahead).
        </p>
        <p>Navigate between months to compare pace over time.</p>
        <Note>Only contracts with hours logged in the selected month are shown.</Note>
      </Body>
    ),
  },
  {
    title: "Consumption",
    description: "Contracted vs. actual utilization per role.",
    body: (
      <Body>
        <p>
          Per contract and role: declared hours, prior-months consumed, consumed this month,
          remaining, and consumption %.
        </p>
        <List
          items={[
            "Change the month.",
            "Sort columns.",
            "Expand a row for the daily breakdown chart.",
          ]}
        />
        <Note>
          &quot;Total&quot; pool contracts (lifetime) and &quot;monthly&quot; pool contracts read
          differently.
        </Note>
      </Body>
    ),
  },
  {
    title: "Capacity",
    description: "Squad and role capacity vs. consumption.",
    body: (
      <Body>
        <p>
          Per squad and per role: capacity hours against billable, non-billable, and available hours
          for the month.
        </p>
        <List items={["Toggle the By Squad / By Role views.", "Sort columns."]} />
        <Note>Requires declarations and hour records to be populated for the month.</Note>
      </Body>
    ),
  },
  {
    title: "Non-Billable",
    description: "Non-billable hour summaries and suggestions.",
    body: (
      <Body>
        <p>
          Totals for NB hours, average NB %, people flagged, and open suggestions, with per-person
          and per-squad breakdowns and risk badges.
        </p>
        <List
          items={[
            "Change the month.",
            "Toggle By Person / By Squad.",
            "Expand a person, or dismiss a suggestion.",
          ]}
        />
        <Note>
          A suggestion is auto-raised when a person exceeds 30% non-billable. Suggestions don&apos;t
          auto-expire.
        </Note>
      </Body>
    ),
  },
  {
    title: "Declarations",
    description: "Monthly role declarations, grouped by client.",
    body: (
      <Body>
        <p>
          Declarations per client show the contract, role, declared vs. consumed hours, and a Draft
          / Confirmed status.
        </p>
        <List items={["Change the month.", "Expand or collapse client groups."]} />
        <Note>This view is read-only — declarations are created and edited in Management.</Note>
      </Body>
    ),
  },
  {
    title: "Flags & Suggestions",
    description: "Anomaly flags and suggestions that need review.",
    body: (
      <Body>
        <p>
          The page has two tabs: open anomaly flags (spike, underuse, pace risk, and more) with
          severity and an explanation, and a Suggestions tab.
        </p>
        <List items={["Dismiss or acknowledge a flag.", "Review items in the Suggestions tab."]} />
      </Body>
    ),
  },
  {
    title: "Simulator",
    description: "Model a new engagement before committing.",
    body: (
      <Body>
        <p>
          Propose an engagement and get a per-role feasibility check: available, or not available.
        </p>
        <List items={["Pick a squad and enter hours per role.", "Run the simulation."]} />
      </Body>
    ),
  },
  {
    title: "Reports",
    description: "Configurable hour-consumption reports with XLSX export.",
    body: (
      <Body>
        <p>
          Build reports across the Clients, Persons, and Squads tabs by choosing filters and visible
          columns.
        </p>
        <List
          items={[
            "Set filters and columns in the panel.",
            "Export the filtered rows to XLSX (generated client-side).",
          ]}
        />
      </Body>
    ),
  },
  {
    title: "Sync",
    description: "Trigger Jira sync and analytics refresh manually.",
    body: (
      <Body>
        <p>
          Shows the last sync status per Jira instance, a shared date-range picker, the data-sync
          and analytics-refresh triggers, and an audit log.
        </p>
        <List
          items={[
            "Pick a date range and a source, then Run Sync.",
            "Run an Analytics Refresh for the months in range.",
            "Review the audit log.",
          ]}
        />
        <Note>Sync is manual and runs per source.</Note>
      </Body>
    ),
  },
  {
    title: "Management",
    description: "Admin CRUD — and where new work is set up.",
    body: (
      <Body>
        <p>
          A tabbed admin area to create and maintain clients, SOWs, contracts, Jira component
          mappings, squads, persons, memberships, roles, declarations, and non-billable categories
          and mappings.
        </p>
        <List
          items={["Create, edit, and archive entities — every delete is soft (no hard deletes)."]}
        />
        <Note>
          Setting up new client work follows a required order — the next slides walk through it.
        </Note>
      </Body>
    ),
  },
  {
    title: "Setup order: Client → SOW → Contract → Mapping",
    description: "New work is built top-down — each step depends on the previous one.",
    body: (
      <Body>
        <List
          ordered
          items={[
            "Create the Client.",
            "Add a Statement of Work (SOW) under the client (start and end date required).",
            "Add a Contract under the SOW — its dates must fall within the SOW range; the pool is monthly or total.",
            "Map the Jira component to that contract so synced worklogs route to it.",
          ]}
        />
        <Note>
          A component mapping must point at an existing contract — you cannot map a Jira component
          before its contract exists.
        </Note>
      </Body>
    ),
  },
  {
    title: "Non-billable source mappings",
    description: "Route Jira worklogs into non-billable categories.",
    body: (
      <Body>
        <p>
          In Management → Non-Billable, map a Jira source to a non-billable category so those
          worklogs are counted as NB.
        </p>
        <Note>
          Only two source types are valid: <span className="font-semibold">Issue Key</span> (
          <code>issue_key</code>) and <span className="font-semibold">Component Key</span> (
          <code>component_key</code>). No other source type is accepted.
        </Note>
        <List
          items={[
            "Create or delete mappings.",
            "Manage categories alongside them — categories are archived, never hard-deleted.",
          ]}
        />
      </Body>
    ),
  },
  {
    title: "Squads and memberships",
    description: "Create squads, then assign people.",
    body: (
      <Body>
        <p>Create a squad (name and optional lead), then add people through squad memberships.</p>
        <List
          items={[
            "Create a squad — the lead must be an active member of that squad.",
            "Add a membership: person + allocation % (0–100) + effective date range.",
            "A person can belong to several squads at once with a split allocation.",
          ]}
        />
        <Note>
          End-dating a membership archives it and preserves history — memberships are never hard-
          deleted.
        </Note>
      </Body>
    ),
  },
  {
    title: "Declarations vs. actual hours",
    description: "Two different inputs drive the consumption numbers.",
    body: (
      <Body>
        <List
          items={[
            <>
              <span className="font-semibold text-foreground">Declaration (planned):</span> the
              hours management expects each role to deliver for a contract in a month. Set in
              Management → Declarations and moved Draft → Confirmed.
            </>,
            <>
              <span className="font-semibold text-foreground">HourRecord (actual):</span> real
              worklogs synced from Jira — person, date, hours, role, ticket.
            </>,
          ]}
        />
        <Note>
          Consumption % = actual consumed ÷ declared. Declarations cap the plan; HourRecords are
          what really happened.
        </Note>
      </Body>
    ),
  },
  {
    title: "Renewing a SOW",
    description: "Roll a Statement of Work into a new term without losing history.",
    body: (
      <Body>
        <List
          items={[
            "Creates a new SOW linked to the old one, with new child contracts.",
            "Re-points open Jira component mappings to the new contracts at the renewal boundary.",
          ]}
        />
        <Note>
          The source SOW is deactivated and its contracts are closed{" "}
          <span className="font-semibold">atomically</span> as part of the renewal — backdated
          worklogs still route to the old contracts, and new worklogs to the new ones.
        </Note>
      </Body>
    ),
  },
];

export function HelpTour({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const last = SLIDES.length - 1;
  const slide = SLIDES[i];

  function handleOpenChange(next: boolean) {
    if (next) setI(0);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="space-y-2 px-6 pb-2 pt-6 pr-10">
          <Badge variant="secondary" className="w-fit">
            Step {i + 1} of {SLIDES.length}
          </Badge>
          <DialogTitle className="text-xl">{slide.title}</DialogTitle>
          <DialogDescription>{slide.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed text-muted-foreground">
          {slide.body}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
          >
            <ChevronLeft />
            Back
          </Button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {SLIDES.map((_, n) => (
              <button
                key={n}
                type="button"
                aria-label={`Go to step ${n + 1}`}
                onClick={() => setI(n)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  n === i ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>

          {i === last ? (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setI((n) => Math.min(last, n + 1))}>
              Next
              <ChevronRight />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
