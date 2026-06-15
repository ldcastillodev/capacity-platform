"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserSquare2 } from "lucide-react";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import {
  fetchSquadCapacity,
  fetchPersonCapacity,
  fetchRoleCapacity,
  type SquadCapacityRow,
  type RoleCapacityRow,
} from "@/lib/client";
import { ConsumptionBar } from "@/components/capacity/ConsumptionBar";
import { Badge } from "@/components/ui/badge";
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

const ROLE_LABELS: Record<string, string> = {
  dev: "Developer",
  devops: "DevOps",
  qa: "QA",
  data: "Data",
  design: "Design",
  product: "Product",
  project: "Project",
  tl: "Tech Lead",
  sre: "SRE",
  seo: "SEO",
  content: "Content",
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);

function pctOf(hours: number, capacity: number): number {
  return capacity > 0 ? (hours / capacity) * 100 : 0;
}

function meanPct(pcts: number[]): number {
  return pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = groups.get(k);
    if (bucket) bucket.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

function ColumnLabel({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}): React.ReactElement {
  return (
    <TableHead
      className={`sticky top-0 z-10 bg-card text-xs uppercase tracking-wide text-muted-foreground ${align === "center" ? "text-center" : ""}`}
    >
      {children}
    </TableHead>
  );
}

function NumCell({
  value,
  strong = false,
}: {
  value: number;
  strong?: boolean;
}): React.ReactElement {
  return (
    <TableCell className={`text-sm text-center tabular-nums ${strong ? "font-semibold" : ""}`}>
      {Number(value.toFixed(2)).toString()}
    </TableCell>
  );
}

function SectionHeader({
  icon,
  name,
  count,
  countLabel,
}: {
  icon: React.ReactNode;
  name: string;
  count: number;
  countLabel: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="font-semibold text-sm">{name}</h3>
      <Badge variant="secondary" className="ml-1">
        {count} {countLabel}
      </Badge>
    </div>
  );
}

function LoadingCard(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyCard({ message }: { message: string }): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function SquadSections({ rows }: { rows: SquadCapacityRow[] }): React.ReactElement {
  const groups = groupBy(rows, (r) => String(r.squad_id));
  return (
    <div className="space-y-5">
      {Array.from(groups.values()).map((squadRows) => {
        const { squad_id, squad_name } = squadRows[0];
        const members = squadRows.filter(
          (r): r is SquadCapacityRow & { person_id: number; person_name: string } =>
            r.person_id !== null
        );
        const totals = {
          capacity: members.reduce((s, m) => s + m.capacity_hours, 0),
          billable: members.reduce((s, m) => s + m.billable_hours, 0),
          nonbillable: members.reduce((s, m) => s + m.nonbillable_hours, 0),
          billablePct: meanPct(members.map((m) => pctOf(m.billable_hours, m.capacity_hours))),
          nonbillablePct: meanPct(members.map((m) => pctOf(m.nonbillable_hours, m.capacity_hours))),
        };
        return (
          <Card key={squad_id}>
            <CardContent className="p-0">
              <SectionHeader
                icon={<Users className="h-4 w-4" />}
                name={squad_name}
                count={members.length}
                countLabel={members.length === 1 ? "member" : "members"}
              />
              {members.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No members in this squad for this month.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <ColumnLabel align="left">Person</ColumnLabel>
                        <ColumnLabel>Capacity (h)</ColumnLabel>
                        <ColumnLabel>Consumed Billable (h)</ColumnLabel>
                        <ColumnLabel>% Billable</ColumnLabel>
                        <ColumnLabel>Non-Billable (h)</ColumnLabel>
                        <ColumnLabel>% Non-Billable</ColumnLabel>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.person_id}>
                          <TableCell className="text-sm font-medium">{m.person_name}</TableCell>
                          <NumCell value={m.capacity_hours} />
                          <NumCell value={m.billable_hours} />
                          <TableCell className="min-w-[160px] w-[18%]">
                            <ConsumptionBar
                              variant="billable"
                              pct={pctOf(m.billable_hours, m.capacity_hours)}
                              hasCapacity={m.capacity_hours > 0}
                            />
                          </TableCell>
                          <NumCell value={m.nonbillable_hours} />
                          <TableCell className="min-w-[160px] w-[18%]">
                            <ConsumptionBar
                              variant="nonbillable"
                              pct={pctOf(m.nonbillable_hours, m.capacity_hours)}
                              hasCapacity={m.capacity_hours > 0}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 hover:bg-muted/50 font-semibold">
                        <TableCell className="text-sm">Squad total</TableCell>
                        <NumCell value={totals.capacity} strong />
                        <NumCell value={totals.billable} strong />
                        <TableCell className="min-w-[160px] w-[18%]">
                          <ConsumptionBar
                            variant="billable"
                            pct={totals.billablePct}
                            hasCapacity={totals.capacity > 0}
                          />
                        </TableCell>
                        <NumCell value={totals.nonbillable} strong />
                        <TableCell className="min-w-[160px] w-[18%]">
                          <ConsumptionBar
                            variant="nonbillable"
                            pct={totals.nonbillablePct}
                            hasCapacity={totals.capacity > 0}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RoleSections({ rows }: { rows: RoleCapacityRow[] }): React.ReactElement {
  const groups = groupBy(rows, (r) => String(r.squad_id));
  return (
    <div className="space-y-5">
      {Array.from(groups.values()).map((squadRows) => {
        const { squad_id, squad_name } = squadRows[0];
        const roles = [...squadRows].sort(
          (a, b) => ROLE_ORDER.indexOf(a.role_type) - ROLE_ORDER.indexOf(b.role_type)
        );
        const totals = {
          capacity: roles.reduce((s, r) => s + r.capacity_hours, 0),
          declared: roles.reduce((s, r) => s + r.declared_hours, 0),
          billable: roles.reduce((s, r) => s + r.billable_hours, 0),
          nonbillable: roles.reduce((s, r) => s + r.nonbillable_hours, 0),
          billablePct: meanPct(roles.map((r) => pctOf(r.billable_hours, r.capacity_hours))),
          nonbillablePct: meanPct(roles.map((r) => pctOf(r.nonbillable_hours, r.capacity_hours))),
        };
        return (
          <Card key={squad_id}>
            <CardContent className="p-0">
              <SectionHeader
                icon={<UserSquare2 className="h-4 w-4" />}
                name={squad_name}
                count={roles.length}
                countLabel={roles.length === 1 ? "role" : "roles"}
              />
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <ColumnLabel align="left">Role</ColumnLabel>
                      <ColumnLabel>Capacity (h)</ColumnLabel>
                      <ColumnLabel>Declared to Clients (h)</ColumnLabel>
                      <ColumnLabel>Consumed Billable (h)</ColumnLabel>
                      <ColumnLabel>% Billable</ColumnLabel>
                      <ColumnLabel>Non-Billable (h)</ColumnLabel>
                      <ColumnLabel>% Non-Billable</ColumnLabel>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((r) => (
                      <TableRow key={r.role_type}>
                        <TableCell className="text-sm font-medium">
                          {ROLE_LABELS[r.role_type] ?? r.role_type}
                        </TableCell>
                        <NumCell value={r.capacity_hours} />
                        <NumCell value={r.declared_hours} />
                        <NumCell value={r.billable_hours} />
                        <TableCell className="min-w-[160px] w-[18%]">
                          <ConsumptionBar
                            variant="billable"
                            pct={pctOf(r.billable_hours, r.capacity_hours)}
                            hasCapacity={r.capacity_hours > 0}
                          />
                        </TableCell>
                        <NumCell value={r.nonbillable_hours} />
                        <TableCell className="min-w-[160px] w-[18%]">
                          <ConsumptionBar
                            variant="nonbillable"
                            pct={pctOf(r.nonbillable_hours, r.capacity_hours)}
                            hasCapacity={r.capacity_hours > 0}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50 font-semibold">
                      <TableCell className="text-sm">Squad total</TableCell>
                      <NumCell value={totals.capacity} strong />
                      <NumCell value={totals.declared} strong />
                      <NumCell value={totals.billable} strong />
                      <TableCell className="min-w-[160px] w-[18%]">
                        <ConsumptionBar
                          variant="billable"
                          pct={totals.billablePct}
                          hasCapacity={totals.capacity > 0}
                        />
                      </TableCell>
                      <NumCell value={totals.nonbillable} strong />
                      <TableCell className="min-w-[160px] w-[18%]">
                        <ConsumptionBar
                          variant="nonbillable"
                          pct={totals.nonbillablePct}
                          hasCapacity={totals.capacity > 0}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function CapacityPage(): React.ReactElement {
  const [month, setMonth] = useMonth();

  const { data: squadRows = [], isLoading: squadsLoading } = useQuery({
    queryKey: ["squad-capacity", month],
    queryFn: () => fetchSquadCapacity({ month }),
  });

  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ["person-capacity", month],
    queryFn: () => fetchPersonCapacity({ month }),
  });

  const { data: roleRows = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["role-capacity", month],
    queryFn: () => fetchRoleCapacity({ month }),
  });

  return (
    <div>
      <PageHeader
        title="Monthly Capacity"
        description={`${formatMonthDisplay(month)} · Available hours by squad, person, and role`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />
      <Tabs defaultValue="squads">
        <TabsList className="mb-5">
          <TabsTrigger value="squads">By Squad</TabsTrigger>
          <TabsTrigger value="persons">By Person</TabsTrigger>
          <TabsTrigger value="roles">By Role</TabsTrigger>
        </TabsList>

        <TabsContent value="squads">
          {squadsLoading ? (
            <LoadingCard />
          ) : squadRows.length === 0 ? (
            <EmptyCard message="No active squads." />
          ) : (
            <SquadSections rows={squadRows} />
          )}
        </TabsContent>

        <TabsContent value="persons">
          {personsLoading ? (
            <LoadingCard />
          ) : persons.length === 0 ? (
            <EmptyCard message="No active persons." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <ColumnLabel align="left">Person</ColumnLabel>
                        <ColumnLabel align="left">Squad(s)</ColumnLabel>
                        <ColumnLabel>Capacity (h)</ColumnLabel>
                        <ColumnLabel>Consumed Billable (h)</ColumnLabel>
                        <ColumnLabel>% Billable</ColumnLabel>
                        <ColumnLabel>Non-Billable (h)</ColumnLabel>
                        <ColumnLabel>% Non-Billable</ColumnLabel>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persons.map((row) => (
                        <TableRow key={row.person_id}>
                          <TableCell className="text-sm font-medium">{row.person_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.squad_names}
                          </TableCell>
                          <NumCell value={row.capacity_hours} />
                          <NumCell value={row.billable_hours} />
                          <TableCell className="min-w-[160px] w-[18%]">
                            <ConsumptionBar
                              variant="billable"
                              pct={pctOf(row.billable_hours, row.capacity_hours)}
                              hasCapacity={row.capacity_hours > 0}
                            />
                          </TableCell>
                          <NumCell value={row.nonbillable_hours} />
                          <TableCell className="min-w-[160px] w-[18%]">
                            <ConsumptionBar
                              variant="nonbillable"
                              pct={pctOf(row.nonbillable_hours, row.capacity_hours)}
                              hasCapacity={row.capacity_hours > 0}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="roles">
          {rolesLoading ? (
            <LoadingCard />
          ) : roleRows.length === 0 ? (
            <EmptyCard message="No role data for this month." />
          ) : (
            <RoleSections rows={roleRows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
