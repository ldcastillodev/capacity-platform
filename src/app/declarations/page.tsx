"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonthNavigator } from "@/components/app/MonthNavigator";
import { PageHeader } from "@/components/app/PageHeader";
import { useMonth, formatMonthDisplay } from "@/hooks/useMonth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchDeclarations, type Declaration, type DeclarationStatus } from "@/lib/client";
import { formatHours } from "@/lib/utils/formatting";

const ROLE_LABELS: Record<string, string> = {
  dev: "Dev",
  qa: "QA",
  devops: "DevOps",
  design: "UX Designer",
  product: "Product Manager",
  project: "Project Manager",
  tl: "Tech Lead",
  sre: "Site Reliability Engineer",
  data: "Data Engineer",
  business_analyst: "Business Analyst",
  seo: "SEO",
  content: "Content",
};

const STATUS_CFG: Record<DeclarationStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "✓ Confirmed", className: "bg-green-50 text-green-700 border-green-200" },
};

function DeclarationBadge({ status }: { status: DeclarationStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-semibold whitespace-nowrap", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}

function ConsumedBadge({ declared, consumed }: { declared: number; consumed: number }) {
  const over = consumed > declared;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold whitespace-nowrap",
        over
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-green-50 text-green-700 border-green-200"
      )}
    >
      {over ? "over" : "normal"}
    </Badge>
  );
}

export default function DeclarationsPage() {
  const [month, setMonth] = useMonth();
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());

  const { data: declarations, isLoading } = useQuery({
    queryKey: ["declarations", month],
    queryFn: () => fetchDeclarations({ month }),
  });

  function toggleClient(id: number) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  type ClientGroup = { clientId: number; clientName: string; decls: Declaration[] };
  const byClient = new Map<number, ClientGroup>();
  for (const d of declarations ?? []) {
    if (!byClient.has(d.client_id)) {
      byClient.set(d.client_id, { clientId: d.client_id, clientName: d.client.name, decls: [] });
    }
    byClient.get(d.client_id)!.decls.push(d);
  }
  const clientGroups = Array.from(byClient.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  return (
    <div>
      <PageHeader
        title="Declarations"
        description={`${formatMonthDisplay(month)} · Role allocation by contract`}
        actions={<MonthNavigator month={month} onChange={setMonth} />}
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (declarations ?? []).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No declarations for this period.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clientGroups.map(({ clientId, clientName, decls }) => {
          const expanded = expandedClients.has(clientId);
          const confirmedCount = decls.filter((d) => d.status === "confirmed").length;
          return (
            <Card key={clientId} className="overflow-hidden">
              <CardHeader
                className="py-3 px-5 bg-muted/40 border-b flex-row items-center justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleClient(clientId)}
              >
                <div className="flex items-center gap-2.5">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-bold text-base">{clientName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {confirmedCount}/{decls.length} confirmed
                  </Badge>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="p-0">
                  {decls.map((decl) => (
                    <div key={decl.id} className="border-b last:border-b-0">
                      <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 border-b text-sm flex-wrap">
                        <span className="font-semibold text-muted-foreground">
                          {decl.contract?.name ?? "No contract"}
                        </span>
                        <DeclarationBadge status={decl.status} />
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Declared</TableHead>
                            <TableHead className="text-right">Consumed</TableHead>
                            <TableHead>Declaration Status</TableHead>
                            <TableHead>Declared vs Consumed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {decl.roles.map((r) => {
                            const declared = parseFloat(r.declared_hours);
                            const consumed = r.consumed_hours;
                            return (
                              <TableRow key={r.role_type}>
                                <TableCell>{ROLE_LABELS[r.role_type] ?? r.role_type}</TableCell>
                                <TableCell className="text-right">
                                  {formatHours(declared)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatHours(consumed)}
                                </TableCell>
                                <TableCell>
                                  <DeclarationBadge status={decl.status} />
                                </TableCell>
                                <TableCell>
                                  <ConsumedBadge declared={declared} consumed={consumed} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
