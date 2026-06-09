"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Squad } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_TYPES } from "@/hooks/declarations";
import { RoleBreakdownInput } from "./RoleBreakdownInput";

const schema = z
  .object({
    squadId: z.coerce.number().int().positive("Pick a squad"),
    requiredHours: z.coerce.number().positive("Must be positive"),
    roles: z
      .array(
        z.object({
          roleType: z.enum(ROLE_TYPES as [string, ...string[]], {
            errorMap: () => ({ message: "Pick a role" }),
          }),
          hours: z.coerce.number().positive("Must be > 0"),
        }),
      )
      .min(1, "Add at least one role"),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    val.roles.forEach((r, idx) => {
      if (seen.has(r.roleType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles", idx, "roleType"],
          message: "Duplicate role",
        });
      }
      seen.add(r.roleType);
    });
    const sum = val.roles.reduce((a, r) => a + (Number(r.hours) || 0), 0);
    if (Math.abs(sum - val.requiredHours) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: `Sum (${sum}h) must equal required hours (${val.requiredHours}h)`,
      });
    }
  });

export type SimulatorFormValues = z.infer<typeof schema>;

interface Props {
  squads: Squad[];
  squadsLoading: boolean;
  isPending: boolean;
  onSubmit: (values: SimulatorFormValues) => void;
}

export function SimulatorForm({ squads, squadsLoading, isPending, onSubmit }: Props) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SimulatorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      squadId: undefined as unknown as number,
      requiredHours: undefined as unknown as number,
      roles: [],
    },
    mode: "onChange",
  });

  const watchedRoles = useWatch({ control, name: "roles" }) ?? [];
  const watchedRequiredHours = useWatch({ control, name: "requiredHours" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proposed engagement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Squad</Label>
            <Controller
              control={control}
              name="squadId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(v) => field.onChange(Number(v))}
                  disabled={squadsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={squadsLoading ? "Loading…" : "Select a squad"} />
                  </SelectTrigger>
                  <SelectContent>
                    {squads.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.squadId && (
              <p className="text-xs text-[var(--critical)]">{errors.squadId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Required hours / month</Label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 120"
              {...register("requiredHours")}
            />
            {errors.requiredHours && (
              <p className="text-xs text-[var(--critical)]">{errors.requiredHours.message}</p>
            )}
          </div>

          <RoleBreakdownInput
            control={control}
            register={register}
            errors={errors}
            requiredHours={watchedRequiredHours as number | undefined}
            watchedRoles={watchedRoles}
          />

          <Button type="submit" className="w-full" disabled={!isValid || isPending}>
            {isPending ? "Simulating…" : "Run simulation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
