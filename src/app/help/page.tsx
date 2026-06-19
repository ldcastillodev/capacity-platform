"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { HelpTour } from "./HelpTour";

export default function HelpPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="How to Use"
        description="A guided tour of every page and the core admin workflows."
      />

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-foreground">Need Help?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          A short slide-by-slide walkthrough of each page — what it shows, what you can do, and the
          key limitations — plus the step-by-step setup workflows in Management.
        </p>
        <Button size="lg" onClick={() => setOpen(true)}>
          Start tutorial
        </Button>
      </div>

      <HelpTour open={open} onOpenChange={setOpen} />
    </div>
  );
}
