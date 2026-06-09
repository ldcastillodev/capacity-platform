"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ReportBuilder } from "@/components/reports/ReportBuilder";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Hours by person, squad, client, contract, SOW, or role — planned vs actual"
      />
      <Suspense fallback={null}>
        <ReportBuilder />
      </Suspense>
    </div>
  );
}
