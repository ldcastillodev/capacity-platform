import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleType =
  | "dev"
  | "qa" | "devops"
  | "data" | "tl" 
  | "product" | "project"
  | "seo" | "content" |
   "sre" | "design";

export interface Client {
  id: number;
  name: string;
  region: string;
  currency: string;
  isActive: boolean;
  is_active: boolean;
}

export interface Squad {
  id: number;
  name: string;
}

export interface Person {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  is_active: boolean;
}

export interface NonBillableSummary {
  id: number;
  personId: number;
  person_id: number;
  squadId: number;
  squad_id: number;
  month: string;
  categoryType: string | null;
  category_type: string | null;
  totalHours: string;
  total_hours: string;
  capacityHours: string;
  capacity_hours: string;
  nonbillablePct: string;
  nonbillable_pct: string;
  monthOverMonthDelta: string | null;
  month_over_month_delta: string | null;
}

export interface NbEntry {
  date: string;
  hours: number;
  external_ref: string | null;
  notes: string | null;
}

export interface NbEntryGroup {
  category_type: string;
  category_name: string;
  total_hours: number;
  entries: NbEntry[];
}

export interface EnhancementSuggestion {
  id: number;
  personId: number;
  person_id: number;
  squadId: number | null;
  squad_id: number | null;
  month: string;
  suggestionType: string;
  suggestion_type: string;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  explanation: string | null;
  suggestedAction: string | null;
  suggested_action: string | null;
  suggestedHours: string | null;
  suggested_hours: string | null;
  currentHours: string | null;
  current_hours: string | null;
}

export interface SimulationResult {
  proposed_client_name: string;
  proposed_start_month: string;
  feasible: boolean;
  bottleneck_role: RoleType | null;
  line_items: Array<{
    role_type: RoleType;
    requested_hours: number;
    available_hours: number;
    gap_hours: number;
    action: "available" | "hire_needed" | "redistribute";
    ftes_to_hire: number;
  }>;
}

// ─── API functions ────────────────────────────────────────────────────────────

// Normalize Prisma camelCase to legacy snake_case that pages expect
function norm<T>(data: T): T {
  if (Array.isArray(data)) return data.map(norm) as unknown as T;
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      // Add snake_case alias for every camelCase key
      out[k] = norm(v);
      const snake = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (snake !== k) out[snake] = norm(v);
    }
    return out as T;
  }
  return data;
}

export const fetchClients = () =>
  api.get<Client[]>("/clients").then((r) => norm(r.data));

export const fetchSquads = () =>
  api.get<Squad[]>("/squads").then((r) => norm(r.data));

export const fetchPeople = () =>
  api.get<Person[]>("/people").then((r) => norm(r.data));

export const fetchNonBillableSummary = (params?: { month?: string; squad_id?: number }) =>
  api.get<NonBillableSummary[]>("/analytics/nonbillable-summary", { params }).then((r) => norm(r.data));

export const fetchNonBillableEntries = (person_id: number, month: string) =>
  api.get<NbEntryGroup[]>("/analytics/nonbillable-entries", { params: { person_id, month } }).then((r) => r.data);

export const fetchSuggestions = (params?: { month?: string; status?: string }) =>
  api.get<EnhancementSuggestion[]>("/analytics/suggestions", { params }).then((r) => norm(r.data));

export const dismissSuggestion = (id: number) =>
  api.patch(`/analytics/suggestions/${id}/status`, { status: "dismissed" }).then((r) => r.data);

export const runSimulation = (body: {
  proposed_client_name: string;
  proposed_start_month: string;
  proposed_pool_hours: number;
  role_breakdown: Array<{ role_type: RoleType; hours_per_month: number }>;
}) => api.post<SimulationResult>("/analytics/simulate", body).then((r) => r.data);

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  month: string;
  total_active_clients: number;
  clients_on_track: number;
  clients_at_risk: number;
  clients_critical: number;
  open_anomaly_flags: number;
  understaffed_roles: number;
  total_gross_margin_pct: number | null;
}

export const fetchDashboard = (month?: string) =>
  api.get<DashboardSummary>("/analytics/dashboard", { params: { month } }).then((r) => r.data);

// ─── Burn snapshots ───────────────────────────────────────────────────────────

export type AlertLevel = "safe" | "watch" | "warning" | "critical";

export interface BurnByContractRow {
  contract_id: number;
  contract_name: string;
  client_id: number;
  client_name: string;
  consumed_hours: number;
  pool_hours: number;
  utilization_pct: number;
}

export const fetchBurnByContract = (params?: { month?: string }) =>
  api.get<BurnByContractRow[]>("/analytics/burn-by-contract", { params }).then((r) => r.data);

export interface ConsumptionByContractRow {
  contract_id: number;
  contract_name: string;
  client_id: number;
  client_name: string;
  declared_hours: number;
  consumed_hours: number;
  remaining_hours: number;
  utilization_pct: number;
}

export const fetchConsumptionByContract = (params?: { month?: string }) =>
  api.get<ConsumptionByContractRow[]>("/analytics/consumption-by-contract", { params }).then((r) => r.data);

export interface NbByClientRow {
  client_id: number;
  client_name: string;
  total_hours: number;
}

export const fetchNbByClient = (params?: { month?: string }) =>
  api.get<NbByClientRow[]>("/analytics/nb-by-client", { params }).then((r) => r.data);

export interface NbByContractRow {
  contract_id: number;
  contract_name: string;
  client_name: string;
  total_hours: number;
}

export const fetchNbByContract = (params?: { month?: string }) =>
  api.get<NbByContractRow[]>("/analytics/nb-by-contract", { params }).then((r) => r.data);

export interface NbBySquadRow {
  squad_id: number;
  squad_name: string;
  total_hours: number;
  capacity_hours: number;
  nb_pct: number;
}

export const fetchNbBySquad = (params?: { month?: string }) =>
  api.get<NbBySquadRow[]>("/analytics/nb-by-squad", { params }).then((r) => r.data);

export interface SquadCapacityRow {
  squad_id: number;
  squad_name: string;
  member_count: number;
  capacity_hours: number;
  actual_hours: number;
  utilisation_pct: number;
}

export const fetchSquadCapacity = (params?: { month?: string }) =>
  api.get<SquadCapacityRow[]>("/analytics/squad-capacity", { params }).then((r) => r.data);

export interface PersonCapacityRow {
  person_id: number;
  person_name: string;
  squad_names: string;
  capacity_hours: number;
  actual_hours: number;
  utilisation_pct: number;
}

export const fetchPersonCapacity = (params?: { month?: string }) =>
  api.get<PersonCapacityRow[]>("/analytics/person-capacity", { params }).then((r) => r.data);

export interface BurnByContractWeeklyRow {
  contract_id: number;
  contract_name: string;
  client_id: number;
  client_name: string;
  pool_hours: number;
  consumed_hours: number;
  utilization_pct: number;
  alert_level: string;
  weeks: Array<{ week_start: string; cumulative_hours: number; expected_cumulative: number; pool_hours: number }>;
}

export const fetchBurnByContractWeekly = (params?: { month?: string }) =>
  api.get<BurnByContractWeeklyRow[]>("/analytics/burn-by-contract-weekly", { params }).then((r) => r.data);

// ─── Anomaly flags ────────────────────────────────────────────────────────────

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface AnomalyFlag {
  id: number;
  client_id: number;
  squad_id: number | null;
  month: string;
  role_type: RoleType | null;
  flag_type: string;
  severity: AnomalySeverity;
  explanation: string | null;
  detected_at: string;
  resolved_at: string | null;
}

export const fetchFlags = (params?: { client_id?: number; month?: string; open_only?: boolean }) =>
  api.get<AnomalyFlag[]>("/analytics/flags", { params }).then((r) => norm(r.data));

export const resolveFlag = (flag_id: number, resolution_notes: string) =>
  api.patch(`/analytics/flags/${flag_id}/resolve`, { resolution_notes }).then((r) => r.data);

// ─── Contracts ────────────────────────────────────────────────────────────────

export interface Contract {
  id: number;
  name: string;
  sowId: number;
  hourType: string;
  type: string;
  assignedHours: string;
  startDate: string;
  endDate: string | null;
  status: string;
  sow: { clientId: number; name: string };
}

export const fetchContractsByClient = (clientId: number) =>
  api.get<Contract[]>("/contracts", { params: { client_id: clientId } }).then((r) => r.data);

// ─── Declarations ─────────────────────────────────────────────────────────────

export type DeclarationStatus = "draft" | "confirmed";

export interface DeclarationRole {
  role_type: string;
  declared_hours: string;
  consumed_hours: number;
}

export interface Declaration {
  id: number;
  contract_id: number | null;
  client_id: number;
  squad_id: number | null;
  month: string;
  status: DeclarationStatus;
  client: { id: number; name: string };
  squad: { id: number; name: string };
  contract: { id: number; name: string } | null;
  roles: DeclarationRole[];
}

export const fetchDeclarations = (params?: { month?: string }) =>
  api.get<Declaration[]>("/declarations", { params }).then((r) => r.data);

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportGroupBy = "person" | "squad" | "client" | "contract" | "role" | "month";
export type ReportBillability = "all" | "billable" | "nonbillable";

export type ReportFilterParams = {
  from?: string;
  to?: string;
  groupBy?: ReportGroupBy;
  billability?: ReportBillability;
  personIds?: number[];
  squadIds?: number[];
  clientIds?: number[];
  contractIds?: number[];
  sowIds?: number[];
  roleTypes?: string[];
};

export type ReportKpis = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  plannedHours: number | null;
  utilizationPct: number | null;
};

export type ReportSeriesPoint = {
  month: string;
  billable: number;
  nonBillable: number;
  planned: number | null;
};

export type ReportRow = {
  key: string;
  groupKey: string;
  label: string;
  month: string;
  billableHours: number;
  nonBillableHours: number;
  plannedHours: number | null;
  utilizationPct: number | null;
};

export type ReportHoursResponse = {
  kpis: ReportKpis;
  series: ReportSeriesPoint[];
  rows: ReportRow[];
  groupBy: ReportGroupBy;
};

export type FilterOption = { id: number; name: string };
export type ContractOption = FilterOption & { sowId: number };
export type SowOption = FilterOption & { clientId: number };

export type ReportFilterOptions = {
  persons: FilterOption[];
  squads: FilterOption[];
  clients: FilterOption[];
  contracts: ContractOption[];
  sows: SowOption[];
};

function toQuery(params: ReportFilterParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (params.from) q.from = params.from;
  if (params.to) q.to = params.to;
  if (params.groupBy) q.groupBy = params.groupBy;
  if (params.billability) q.billability = params.billability;
  if (params.personIds?.length) q.personIds = params.personIds.join(",");
  if (params.squadIds?.length) q.squadIds = params.squadIds.join(",");
  if (params.clientIds?.length) q.clientIds = params.clientIds.join(",");
  if (params.contractIds?.length) q.contractIds = params.contractIds.join(",");
  if (params.sowIds?.length) q.sowIds = params.sowIds.join(",");
  if (params.roleTypes?.length) q.roleTypes = params.roleTypes.join(",");
  return q;
}

export const fetchReportHours = (params: ReportFilterParams) =>
  api.get<ReportHoursResponse>("/reports/hours", { params: toQuery(params) }).then((r) => r.data);

export const fetchReportFilters = () =>
  api.get<ReportFilterOptions>("/reports/filters").then((r) => r.data);
