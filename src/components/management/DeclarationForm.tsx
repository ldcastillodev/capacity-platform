"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, PlusCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useClients, useContractsByClient, useDeclarationsByContract, useRoles, useCreateDeclaration,
  type RoleType, type CreateDeclarationPayload,
} from "@/hooks/declarations";
import { formatMonthDisplay } from "@/hooks/useMonth";

const ROLE_TYPES_CONST = [
  "dev","devops","qa","design","product","project","tl","sre","data","seo","content",
] as const;

const ROLE_LABELS: Record<string, string> = {
  dev: "Dev", qa: "QA", devops: "DevOps", design: "UX Designer",
  product: "Product Manager", project: "Project Manager", tl: "Tech Lead",
  sre: "Site Reliability Engineer", data: "Data Engineer",
  seo: "SEO", content: "Content",
};

const schema = z.object({
  clientId:   z.string().min(1, "Client is required"),
  contractId: z.string().min(1, "Contract is required"),
  squadId:    z.string().min(1, "Squad is required"),
  month:      z.string().regex(/^\d{4}-\d{2}$/, "Month is required"),
  roles: z
    .array(z.object({
      roleType: z.enum(ROLE_TYPES_CONST, { required_error: "Role is required" }),
      hours: z.coerce.number({ invalid_type_error: "Enter a number" }).positive("Must be > 0"),
    }))
    .min(1, "At least one role required")
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        if (seen.has(r.roleType)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate role", path: [i, "roleType"] });
        }
        seen.add(r.roleType);
      });
    }),
});

type FormValues = z.infer<typeof schema>;

interface DeclarationFormProps {
  squads: Array<{ id: number; name: string }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DeclarationForm({ squads, onSuccess, onCancel }: DeclarationFormProps) {
  const allRoles = useRoles();
  const mutation = useCreateDeclaration();

  const [hoursWarning, setHoursWarning] = useState<{
    totalDeclared: number;
    assignedHours: number;
    payload: CreateDeclarationPayload;
  } | null>(null);

  const {
    control, register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: "", contractId: "", squadId: "", month: "",
      roles: [{ roleType: undefined as unknown as RoleType, hours: undefined as unknown as number }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "roles" });

  const watchClientId   = watch("clientId");
  const watchContractId = watch("contractId");
  const watchMonth      = watch("month");
  const watchRoles      = watch("roles");

  const { data: clients = [] }   = useClients();
  const { data: contracts = [] } = useContractsByClient(watchClientId ? Number(watchClientId) : null);
  const { data: pastDecls = [] } = useDeclarationsByContract(watchContractId ? Number(watchContractId) : null);

  const usedRoles = new Set(watchRoles.map((r) => r.roleType).filter(Boolean));
  const availableRoles = allRoles.filter((r) => !usedRoles.has(r));
  const allRolesUsed = availableRoles.length === 0;

  // check if a declaration already exists for selected contract+month
  const monthAlreadyUsed =
    watchContractId &&
    watchMonth &&
    pastDecls.some((d) => d.month.slice(0, 7) === watchMonth);

  // clone from a past declaration
  function applyClone(declId: string) {
    if (!declId) return;
    const source = pastDecls.find((d) => String(d.id) === declId);
    if (!source) return;
    replace(
      source.roles.map((r) => ({
        roleType: r.roleType as RoleType,
        hours: parseFloat(r.declaredHours),
      })),
    );
  }

  function buildPayload(values: FormValues, force = false): CreateDeclarationPayload {
    return {
      contractId: Number(values.contractId),
      squadId:    Number(values.squadId),
      month:      values.month,
      roles:      values.roles.map((r) => ({ role_type: r.roleType, declared_hours: r.hours })),
      force,
    };
  }

  function onSubmit(values: FormValues) {
    const payload = buildPayload(values);
    mutation.mutate(payload, {
      onSuccess,
      onError: (e: unknown) => {
        const resp = (e as { response?: { data?: { code?: string; total_declared?: number; assigned_hours?: number } } })?.response?.data;
        if (resp?.code === "HOURS_EXCEED" && resp.total_declared !== undefined && resp.assigned_hours !== undefined) {
          setHoursWarning({ totalDeclared: resp.total_declared, assignedHours: resp.assigned_hours, payload });
        }
      },
    });
  }

  function proceedWithForce() {
    if (!hoursWarning) return;
    mutation.mutate({ ...hoursWarning.payload, force: true }, {
      onSuccess: () => { setHoursWarning(null); onSuccess(); },
    });
  }

  const selectedContract = contracts.find((c) => String(c.id) === watchContractId);

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {mutation.error && !(hoursWarning) && (
          <p className="text-sm text-destructive">
            {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(mutation.error)}
          </p>
        )}

        {/* Client */}
        <div className="space-y-1.5">
          <Label>Client *</Label>
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(v) => {
                  field.onChange(v === "none" ? "" : v);
                  setValue("contractId", "");
                }}
                disabled={clients.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clients.length === 0 ? "No clients" : "— Select client —"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select client —</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
          {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
        </div>

        {/* Contract */}
        <div className="space-y-1.5">
          <Label>Contract *</Label>
          <Controller
            control={control}
            name="contractId"
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                disabled={!watchClientId || contracts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !watchClientId
                        ? "Select a client first"
                        : contracts.length === 0
                        ? "No contracts for this client"
                        : "— Select contract —"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select contract —</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({parseFloat(c.assignedHours).toFixed(0)}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.contractId && <p className="text-xs text-destructive">{errors.contractId.message}</p>}
        </div>

        {/* Clone from past declaration */}
        {watchContractId && pastDecls.length > 0 && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-muted-foreground">
              <Copy size={13} /> Clone from past declaration
            </Label>
            <Select onValueChange={applyClone} value="none">
              <SelectTrigger>
                <SelectValue placeholder="— Select month to clone —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select month to clone —</SelectItem>
                {pastDecls.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {formatMonthDisplay(d.month.slice(0, 7) + "-01")} · {d.roles.length} role{d.roles.length !== 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Selecting a month pre-fills the roles below — edit before submitting.</p>
          </div>
        )}

        {/* Squad + Month */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Squad *</Label>
            <Controller
              control={control}
              name="squadId"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="— Select squad —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select squad —</SelectItem>
                    {squads.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.squadId && <p className="text-xs text-destructive">{errors.squadId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Month *</Label>
            <Input type="month" {...register("month")} />
            {errors.month && <p className="text-xs text-destructive">{errors.month.message}</p>}
          </div>
        </div>

        {/* Duplicate month warning */}
        {monthAlreadyUsed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            A declaration already exists for this contract in {formatMonthDisplay(watchMonth + "-01")}. Submitting will be rejected.
          </p>
        )}

        {/* Role rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Roles *</Label>
            {selectedContract && (
              <span className="text-xs text-muted-foreground">
                Contract: {parseFloat(selectedContract.assignedHours).toFixed(0)}h
              </span>
            )}
          </div>
          {fields.map((field, i) => {
            const rowRole = watchRoles[i]?.roleType;
            const rowAvailable = allRoles.filter((r) => r === rowRole || !usedRoles.has(r));
            return (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Controller
                    control={control}
                    name={`roles.${i}.roleType`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value || "none"}
                        onValueChange={(v) => f.onChange(v === "none" ? "" : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="— Select role —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Select role —</SelectItem>
                          {rowAvailable.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.roles?.[i]?.roleType && (
                    <p className="text-xs text-destructive">{errors.roles[i]?.roleType?.message}</p>
                  )}
                </div>
                <div className="w-24 space-y-1">
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="hrs"
                    {...register(`roles.${i}.hours`)}
                  />
                  {errors.roles?.[i]?.hours && (
                    <p className="text-xs text-destructive">{errors.roles[i]?.hours?.message}</p>
                  )}
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(i)}
                    className="text-muted-foreground mt-0.5"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            );
          })}
          {errors.roles?.root && (
            <p className="text-xs text-destructive">{errors.roles.root.message}</p>
          )}
          {errors.roles && !Array.isArray(errors.roles) && (errors.roles as { message?: string }).message && (
            <p className="text-xs text-destructive">{(errors.roles as { message?: string }).message}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={allRolesUsed}
            onClick={() => append({ roleType: undefined as unknown as RoleType, hours: undefined as unknown as number })}
            className="mt-1 text-primary gap-1.5"
          >
            <PlusCircle size={14} /> Add role
          </Button>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create Declaration"}
          </Button>
        </div>
      </form>

      {/* Hours-exceed warning dialog */}
      <Dialog open={hoursWarning !== null} onOpenChange={(v) => { if (!v) setHoursWarning(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hours exceed contract limit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Total declared hours ({hoursWarning?.totalDeclared}h) exceed contracted hours (
            {hoursWarning?.assignedHours}h). Proceed anyway?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoursWarning(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={proceedWithForce}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Proceed anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
