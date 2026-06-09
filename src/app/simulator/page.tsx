"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchSquads, runSimulation, type SimulationResult, type Squad } from "@/lib/client";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { SimulatorForm, type SimulatorFormValues } from "@/components/simulator/SimulatorForm";
import { SimulatorResult } from "@/components/simulator/SimulatorResult";

export default function SimulatorPage() {
  const { data: squads, isLoading: squadsLoading } = useQuery<Squad[]>({
    queryKey: ["squads"],
    queryFn: fetchSquads,
  });

  const { mutate, isPending, data: result, error } = useMutation<
    SimulationResult,
    Error,
    SimulatorFormValues
  >({
    mutationFn: (vals) => runSimulation(vals),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Capacity Simulator"
        description="Check if a squad has capacity for a new engagement this month"
      />

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <div className="lg:w-80 lg:flex-shrink-0">
          <SimulatorForm
            squads={squads ?? []}
            squadsLoading={squadsLoading}
            isPending={isPending}
            onSubmit={(vals) => mutate(vals)}
          />
        </div>

        <div className="flex-1 min-h-0">
          {error && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-[var(--critical)]">
                  Simulation failed: {error.message}
                </p>
              </CardContent>
            </Card>
          )}

          {result && !error && <SimulatorResult result={result} />}
        </div>
      </div>
    </div>
  );
}
