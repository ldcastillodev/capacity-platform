"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { fetchContractsByClient, type Contract } from "@/lib/client";

export type RoleType =
  | "dev" | "devops" | "qa" | "design" | "product"
  | "project" | "tl" | "sre" | "data" | "seo" | "content";

export const ROLE_TYPES: RoleType[] = [
  "dev", "devops", "qa", "design", "product",
  "project", "tl", "sre", "data", "seo", "content",
];

interface ClientOption { id: number; name: string }

export interface ContractDeclaration {
  id: number;
  month: string;
  status: string;
  roles: Array<{ roleType: string; declaredHours: string }>;
}

export function useClients() {
  return useQuery<ClientOption[]>({
    queryKey: ["mgmt-clients-active"],
    queryFn: () => api.get<ClientOption[]>("/management/clients").then((r) => r.data),
  });
}

export function useContractsByClient(clientId: number | null) {
  return useQuery<Contract[]>({
    queryKey: ["contracts-by-client", clientId],
    queryFn: () => fetchContractsByClient(clientId!),
    enabled: clientId !== null,
  });
}

export function useDeclarationsByContract(contractId: number | null) {
  return useQuery<ContractDeclaration[]>({
    queryKey: ["contract-declarations", contractId],
    queryFn: () =>
      api.get<ContractDeclaration[]>(`/contracts/${contractId}/declarations`).then((r) => r.data),
    enabled: contractId !== null,
  });
}

export function useRoles() {
  return ROLE_TYPES;
}

export interface CreateDeclarationPayload {
  contractId: number;
  squadId: number;
  month: string;
  roles: Array<{ role_type: RoleType; declared_hours: number }>;
  force?: boolean;
}

export function useCreateDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, squadId, month, roles, force }: CreateDeclarationPayload) =>
      api
        .post(
          `/contracts/${contractId}/declarations${force ? "?force=true" : ""}`,
          roles.map((r) => ({
            role_type: r.role_type,
            declared_hours: r.declared_hours,
            month: month + "-01",
            squad_id: squadId,
          })),
        )
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mgmt-declarations"] });
      qc.invalidateQueries({ queryKey: ["contract-declarations", vars.contractId] });
    },
  });
}
