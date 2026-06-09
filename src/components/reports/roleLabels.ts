import type { RoleType } from "@/lib/client";

export const ROLE_LABELS: Record<RoleType, string> = {
  dev: "Developer",
  devops: "DevOps",
  qa: "QA",
  data: "Data Engineer",
  design: "UX Designer",
  product: "Product Manager",
  project: "Project Manager",
  tl: "Tech Lead",
  sre: "Site Reliability Engineer",
  seo: "SEO",
  content: "Content Author",
};

export const ROLE_TYPES = Object.keys(ROLE_LABELS) as RoleType[];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Unassigned";
  return ROLE_LABELS[role as RoleType] ?? role;
}

export type GroupBy = "person" | "squad" | "client" | "contract" | "role" | "month";

export const GROUP_BY_LABELS: Record<GroupBy, string> = {
  person: "Person",
  squad: "Squad",
  client: "Client",
  contract: "Contract",
  role: "Role",
  month: "Month",
};

export type Billability = "all" | "billable" | "nonbillable";

export const BILLABILITY_LABELS: Record<Billability, string> = {
  all: "All hours",
  billable: "Billable only",
  nonbillable: "Non-billable only",
};
