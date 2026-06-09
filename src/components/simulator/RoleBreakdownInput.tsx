"use client";

import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import { ROLE_TYPES, type RoleType } from "@/hooks/declarations";
import type { SimulatorFormValues } from "./SimulatorForm";

const ROLE_LABELS: Record<RoleType, string> = {
  dev: "Dev",
  devops: "DevOps",
  qa: "QA",
  design: "Design",
  product: "Product",
  project: "Project",
  tl: "Tech Lead",
  sre: "SRE",
  data: "Data",
  seo: "SEO",
  content: "Content",
};

interface Props {
  control: Control<SimulatorFormValues>;
  register: UseFormRegister<SimulatorFormValues>;
  errors: FieldErrors<SimulatorFormValues>;
  requiredHours: number | undefined;
  watchedRoles: { roleType: string; hours: number }[];
}

export function RoleBreakdownInput({
  control,
  register,
  errors,
  requiredHours,
  watchedRoles,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles",
  });

  const totalAllocated = watchedRoles.reduce(
    (acc, r) => acc + (Number(r.hours) || 0),
    0,
  );
  const target = Number(requiredHours) || 0;
  const matches = target > 0 && Math.abs(totalAllocated - target) < 1e-6;
  const counterColor =
    target === 0
      ? "text-muted-foreground"
      : matches
        ? "text-[var(--safe)]"
        : "text-[var(--critical)]";

  const selectedRoles = new Set(
    watchedRoles
      .map((r) => r.roleType)
      .filter((r): r is RoleType => !!r && (ROLE_TYPES as readonly string[]).includes(r)),
  );

  const rolesError = errors.roles;
  const rolesRootMessage =
    (rolesError && "message" in rolesError && rolesError.message) ||
    (rolesError && "root" in rolesError && rolesError.root?.message);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Role breakdown</Label>
        <span className={`text-xs font-medium ${counterColor}`}>
          {totalAllocated} / {target || "—"} h
        </span>
      </div>

      <div className="space-y-2">
        {fields.map((field, idx) => {
          const currentRole = watchedRoles[idx]?.roleType;
          const hoursError = errors.roles?.[idx]?.hours?.message;
          const roleError = errors.roles?.[idx]?.roleType?.message;
          return (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`roles.${idx}.roleType`}
                  render={({ field: f }) => (
                    <Select
                      value={f.value || undefined}
                      onValueChange={(v) => f.onChange(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_TYPES.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            disabled={r !== currentRole && selectedRoles.has(r)}
                          >
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {roleError && (
                  <p className="text-xs text-[var(--critical)] mt-1">{roleError}</p>
                )}
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Hours"
                  {...register(`roles.${idx}.hours`)}
                />
                {hoursError && (
                  <p className="text-xs text-[var(--critical)] mt-1">{hoursError}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(idx)}
                aria-label="Remove role"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => append({ roleType: "", hours: 0 })}
        disabled={selectedRoles.size >= ROLE_TYPES.length}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add role
      </Button>

      {rolesRootMessage && (
        <p className="text-xs text-[var(--critical)]">{String(rolesRootMessage)}</p>
      )}
    </div>
  );
}
