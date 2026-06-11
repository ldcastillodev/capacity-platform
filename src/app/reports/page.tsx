"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ReportBuilder } from "@/components/reports/ReportBuilder";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Hours by any combination of person, squad, client, SOW, contract, role, or ticket"
      />
      <Suspense fallback={null}>
        <ReportBuilder />
      </Suspense>
    </div>
  );
}
