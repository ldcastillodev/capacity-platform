"use client";

import type React from "react";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();

  return (
    <div>
      <PageHeader
        title="Monthly Capacity"
        description={`${formatMonthDisplay(month)} · Available hours per squad and role`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />
      <p className="text-muted-foreground">Staffing gap data is not available in this version.</p>
    </div>
  );
}
