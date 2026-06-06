"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { fetchClients, fetchFlags, resolveFlag } from "@/lib/client";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertLevel } from "@/lib/client";

const SEVERITY_TONE: Record<string, AlertLevel> = {
  low: "safe",
  medium: "watch",
  high: "warning",
  critical: "critical",
};

const FLAG_LABELS: Record<string, string> = {
  spike: "Unusual Spike",
  underuse: "Underuse",
  pace_risk: "Pace Risk",
  underburn_risk: "Underburn Risk",
  role_substitution: "Role Substitution",
  missing_data: "Missing Data",
};

export default function FlagsPage() {
  const qc = useQueryClient();
  const [resolving, setResolving] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const { data: flags, isLoading } = useQuery({
    queryKey: ["flags"],
    queryFn: () => fetchFlags({ open_only: true }),
  });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  const { mutate: resolve } = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => resolveFlag(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flags"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setResolving(null);
      setNote("");
    },
  });

  return (
    <div>
      <PageHeader
        title="Anomaly Flags"
        description={`${flags?.length ?? 0} open flag${flags?.length !== 1 ? "s" : ""} requiring attention`}
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}

      {!isLoading && (!flags || flags.length === 0) && (
        <div className="rounded-lg border border-green-200 bg-[var(--safe-bg)] p-6 text-[var(--safe)] font-medium">
          All clear — no open flags this month.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(flags ?? []).map((f) => (
          <Card key={f.id}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <StatusBadge
                      tone={SEVERITY_TONE[f.severity] ?? "default"}
                      label={f.severity.toUpperCase()}
                    />
                    <span className="font-semibold">{FLAG_LABELS[f.flag_type] ?? f.flag_type}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {clientMap[f.client_id] ?? `Client ${f.client_id}`}
                    {f.role_type && ` · ${f.role_type}`}
                    {" · "}
                    {new Date(f.detected_at).toLocaleDateString()}
                  </div>
                  {f.explanation && (
                    <div className="text-sm mt-1.5">{f.explanation}</div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolving(resolving === f.id ? null : f.id)}
                  className="ml-4 gap-1.5"
                >
                  <CheckCircle size={14} />
                  Resolve
                </Button>
              </div>

              {resolving === f.id && (
                <div className="mt-4 pt-4 border-t flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Resolution note…"
                    className="flex-1"
                  />
                  <Button
                    disabled={!note.trim()}
                    onClick={() => resolve({ id: f.id, note })}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
