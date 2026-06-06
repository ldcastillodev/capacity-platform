"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { PlusCircle, Trash2 } from "lucide-react";
import { runSimulation, type RoleType, type SimulationResult } from "@/lib/client";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES: RoleType[] = ["dev","devops","qa","design","product","project","tl","sre","data","seo","content"];
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
  content: "Content Author",
  seo: "SEO"
};
const ACTION_COLOR: Record<string, string> = {
  available: "var(--safe)",
  redistribute: "var(--watch)",
  hire_needed: "var(--critical)",
};

const schema = z.object({
  name: z.string().min(1, "Required"),
  startMonth: z.string().min(1, "Required"),
  poolHours: z.coerce.number().positive("Must be positive"),
  roles: z.array(z.object({
    role_type: z.string(),
    hours: z.coerce.number().positive("Must be positive"),
  })).min(1),
});

type FormValues = z.infer<typeof schema>;

export default function SimulatorPage() {
  const { register, control, handleSubmit, setValue, watch, formState: { isValid } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startMonth: "", poolHours: undefined, roles: [{ role_type: "dev", hours: undefined }] },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "roles" });
  const roleValues = watch("roles");

  const { mutate, isPending, data: result } = useMutation<SimulationResult, Error, FormValues>({
    mutationFn: (vals) => runSimulation({
      proposed_client_name: vals.name,
      proposed_start_month: vals.startMonth + "-01",
      proposed_pool_hours: vals.poolHours,
      role_breakdown: vals.roles.map((r) => ({ role_type: r.role_type as RoleType, hours_per_month: r.hours })),
    }),
  });

  return (
    <div>
      <PageHeader
        title="New Client Simulator"
        description="Check if current capacity can absorb a new client — before committing"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposed client details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client name</Label>
              <Input {...register("name")} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label>Start month</Label>
              <Input type="month" {...register("startMonth")} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly pool hours</Label>
              <Input type="number" {...register("poolHours")} placeholder="120" />
            </div>

            <div>
              <p className="font-semibold text-sm mb-3">Role breakdown</p>
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Select
                      value={roleValues[i]?.role_type ?? "dev"}
                      onValueChange={(val) => setValue(`roles.${i}.role_type`, val)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="hrs"
                      className="w-20"
                      {...register(`roles.${i}.hours`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      className="text-muted-foreground"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ role_type: "qa", hours: undefined as unknown as number })}
                className="mt-2 text-primary gap-1.5"
              >
                <PlusCircle size={14} /> Add role
              </Button>
            </div>

            <Button
              className="w-full mt-2"
              disabled={!isValid || isPending}
              onClick={handleSubmit((vals) => mutate(vals))}
            >
              {isPending ? "Simulating…" : "Run simulation"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.feasible ? "border-[var(--safe)] border-2" : "border-[var(--critical)] border-2"}>
            <CardHeader>
              <CardTitle
                className="text-lg"
                style={{ color: result.feasible ? "var(--safe)" : "var(--critical)" }}
              >
                {result.feasible ? "✓ Feasible" : "✗ Hiring required"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.bottleneck_role && (
                <div className="rounded-md p-3 text-sm bg-[var(--critical-bg)] text-[var(--critical)]">
                  Bottleneck: <strong>{ROLE_LABELS[result.bottleneck_role]}</strong>
                </div>
              )}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["Role", "Requested", "Available", "Action"].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.line_items.map((li) => (
                      <TableRow key={li.role_type}>
                        <TableCell className="font-medium">{ROLE_LABELS[li.role_type]}</TableCell>
                        <TableCell>{li.requested_hours}h</TableCell>
                        <TableCell>{li.available_hours}h</TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold" style={{ color: ACTION_COLOR[li.action] ?? undefined }}>
                            {li.action === "available" ? "Available"
                              : li.action === "redistribute" ? "Redistribute"
                              : `Hire ${li.ftes_to_hire} FTE`}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
