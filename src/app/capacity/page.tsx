"use client";

import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { fetchSquadCapacity, fetchPersonCapacity } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CapacityTable({
  isLoading,
  isEmpty,
  emptyMessage,
  headers,
  leftCols = 1,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  headers: string[];
  leftCols?: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <p className="p-6 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h, i) => (
                    <TableHead key={h} className={i >= leftCols ? "text-right" : undefined}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>{children}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();

  const { data: squads = [], isLoading: squadsLoading } = useQuery({
    queryKey: ["squad-capacity", month],
    queryFn: () => fetchSquadCapacity({ month }),
  });

  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ["person-capacity", month],
    queryFn: () => fetchPersonCapacity({ month }),
  });

  return (
    <div>
      <PageHeader
        title="Monthly Capacity"
        description={`${formatMonthDisplay(month)} · Available hours by squad and person`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />
      <Tabs defaultValue="squads">
        <TabsList className="mb-5">
          <TabsTrigger value="squads">By Squad</TabsTrigger>
          <TabsTrigger value="persons">By Person</TabsTrigger>
        </TabsList>

        <TabsContent value="squads">
          <CapacityTable
            isLoading={squadsLoading}
            isEmpty={squads.length === 0}
            emptyMessage="No active squads."
            headers={["Squad", "Members", "Capacity (h)", "Actual (h)", "Utilisation"]}
          >
            {squads.map((row) => (
              <TableRow key={row.squad_id}>
                <TableCell className="font-medium text-sm">{row.squad_name}</TableCell>
                <TableCell className="text-sm text-right">{row.member_count}</TableCell>
                <TableCell className="text-sm text-right">{row.capacity_hours.toFixed(0)}</TableCell>
                <TableCell className="text-sm text-right">{row.actual_hours.toFixed(0)}</TableCell>
                <TableCell className="text-sm text-right">
                  {row.capacity_hours > 0 ? `${row.utilisation_pct.toFixed(0)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </CapacityTable>
        </TabsContent>

        <TabsContent value="persons">
          <CapacityTable
            isLoading={personsLoading}
            isEmpty={persons.length === 0}
            emptyMessage="No active persons."
            headers={["Person", "Squad(s)", "Capacity (h)", "Actual (h)", "Utilisation"]}
            leftCols={2}
          >
            {persons.map((row) => (
              <TableRow key={row.person_id}>
                <TableCell className="font-medium text-sm">{row.person_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.squad_names}</TableCell>
                <TableCell className="text-sm text-right">{row.capacity_hours.toFixed(0)}</TableCell>
                <TableCell className="text-sm text-right">{row.actual_hours.toFixed(0)}</TableCell>
                <TableCell className="text-sm text-right">
                  {row.capacity_hours > 0 ? `${row.utilisation_pct.toFixed(0)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </CapacityTable>
        </TabsContent>
      </Tabs>
    </div>
  );
}
