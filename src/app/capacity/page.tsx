"use client";

import React, { useState } from "react";
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

function SquadMembers({ squadId, month }: { squadId: number; month: string }): React.ReactElement {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["person-capacity", month, squadId],
    queryFn: () => fetchPersonCapacity({ month, squad_id: squadId }),
  });
  if (isLoading) return <p className="py-2 text-sm text-muted-foreground">Loading members…</p>;
  if (members.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No members in this squad for this month.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead className="text-right">Capacity (h)</TableHead>
          <TableHead className="text-right">Consumed (h)</TableHead>
          <TableHead className="text-right">% Consumed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.person_id}>
            <TableCell className="text-sm">{m.person_name}</TableCell>
            <TableCell className="text-sm text-right">{m.capacity_hours.toFixed(0)}</TableCell>
            <TableCell className="text-sm text-right">{m.actual_hours.toFixed(0)}</TableCell>
            <TableCell className="text-sm text-right">
              {m.capacity_hours > 0 ? `${m.utilisation_pct.toFixed(0)}%` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();
  const [expandedSquad, setExpandedSquad] = useState<number | null>(null);

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
            headers={["Squad", "Members", "Capacity (h)", "Consumed (h)", "% Consumed"]}
          >
            {squads.map((row) => (
              <React.Fragment key={row.squad_id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedSquad(expandedSquad === row.squad_id ? null : row.squad_id)}
                >
                  <TableCell className="font-medium text-sm">
                    <span className="mr-2 text-muted-foreground">{expandedSquad === row.squad_id ? "▾" : "▸"}</span>
                    {row.squad_name}
                  </TableCell>
                  <TableCell className="text-sm text-right">{row.member_count}</TableCell>
                  <TableCell className="text-sm text-right">{row.capacity_hours.toFixed(0)}</TableCell>
                  <TableCell className="text-sm text-right">{row.actual_hours.toFixed(0)}</TableCell>
                  <TableCell className="text-sm text-right">
                    {row.capacity_hours > 0 ? `${row.utilisation_pct.toFixed(0)}%` : "—"}
                  </TableCell>
                </TableRow>
                {expandedSquad === row.squad_id && (
                  <TableRow>
                    <TableCell colSpan={5} className="bg-muted/30 px-6">
                      <SquadMembers squadId={row.squad_id} month={month} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </CapacityTable>
        </TabsContent>

        <TabsContent value="persons">
          <CapacityTable
            isLoading={personsLoading}
            isEmpty={persons.length === 0}
            emptyMessage="No active persons."
            headers={["Person", "Squad(s)", "Capacity (h)", "Consumed (h)", "% Consumed"]}
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
