import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleType =
  | "frontend_dev" | "backend_dev" | "fullstack_dev"
  | "qa" | "devops" | "pm" | "ux" | "ux_designer"
  | "data_engineer" | "tech_lead" | "sme"
  | "product_manager" | "project_manager"
  | "seo" | "content_author" | "client_services"
  | "scrum_master" | "solutions_architect" | "business_analyst";

export interface StaffingGap {
  squadId: number;
  squad_id: number;
  roleType: string;
  role_type: string;
  month: string;
  totalAvailableHours: number;
  total_available_hours: number;
  hardBufferHours: number;
  hard_buffer_hours: number;
  committedHours: number;
  committed_hours: number;
  actualHours: number;
  actual_hours: number;
  unplannedHours: number;
  unplanned_hours: number;
  actualNbHours: number;
  actual_nb_hours: number;
  netGapHours: number;
  net_gap_hours: number;
  commitmentRatio: number;
  commitment_ratio: number;
  isUnderstaffed: boolean;
  is_understaffed: boolean;
  isOverstaffed: boolean;
  is_overstaffed: boolean;
}

export interface ConsumptionSummary {
  clientId: number;
  client_id: number;
  month: string;
  roleType: string | null;
  role_type: string | null;
  declaredHours: number;
  declared_hours: number;
  consumedHours: number;
  consumed_hours: number;
  remainingHours: number;
  remaining_hours: number;
  utilizationPct: number;
  utilization_pct: number;
}

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

export const fetchStaffingGaps = (params?: { squad_id?: number; month?: string }) =>
  api.get<StaffingGap[]>("/analytics/staffing", { params }).then((r) => norm(r.data));

export const fetchConsumption = (params?: { client_id?: number; month?: string }) =>
  api.get<ConsumptionSummary[]>("/analytics/consumption", { params }).then((r) => norm(r.data));

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

export interface BurnSnapshot {
  client_id: number;
  week_start: string;
  role_type: RoleType | null;
  cumulative_hours: number;
  expected_cumulative: number;
  burn_rate_ratio: number;
  projected_eom_hours: number;
  pool_hours: number;
  alert_level: AlertLevel;
  projected_exhaustion_date: string | null;
}

export const fetchBurnSnapshots = (params?: { client_id?: number; month?: string }) =>
  api.get<BurnSnapshot[]>("/analytics/burn", { params }).then((r) => norm(r.data));

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

// ─── Declarations ─────────────────────────────────────────────────────────────

export type DeclarationStatus = "draft" | "derived" | "confirmed" | "locked";

export interface Declaration {
  id: number;
  contract_id: number | null;
  client_id: number;
  squad_id: number | null;
  month: string;
  role_type: string;
  declared_hours: string;
  status: DeclarationStatus;
  submitted_at: string | null;
}

export const fetchDeclarations = (params?: { month?: string; squad_id?: number }) =>
  api.get<Declaration[]>("/declarations", { params }).then((r) => norm(r.data));

export const updateDeclaration = (id: number, declared_hours: number) =>
  api.patch<Declaration>(`/declarations/${id}`, { declared_hours }).then((r) => norm(r.data));

export const confirmDeclaration = (id: number) =>
  api.post<Declaration>(`/declarations/${id}/confirm`).then((r) => norm(r.data));

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportPage<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ClientReportRow = {
  id: number;
  clientId: number;
  month: string;
  roleType: string | null;
  declaredHours: string;
  consumedHours: string;
  retainerHours: string;
  teHours: string;
  coHours: string;
  smeHours: string;
  remainingHours: string;
  utilizationPct: string;
  billedRevenue: string | null;
  directCost: string | null;
  grossMargin: string | null;
  grossMarginPct: string | null;
  ceremonyHours: number;
  client: { id: number; name: string; region: string; currency: string };
};

export type PersonReportRow = {
  person_id: number;
  person_name: string;
  employment_type: string;
  squad_id: number;
  squad_name: string;
  month: string;
  billable_hours: string;
  nb_hours: string;
  capacity_hours: string;
  nb_pct: string;
};

export type SquadReportRow = {
  squad_id: number;
  squad_name: string;
  month: string;
  billable_hours: string;
  nb_hours: string;
  capacity_hours: string;
  role_type: string | null;
};

export const fetchReportClients = (params: {
  from?: string; to?: string; clientId?: number; roleType?: string;
  page?: number; pageSize?: number;
}) =>
  api.get<ReportPage<ClientReportRow>>("/reports/clients", { params }).then((r) => r.data);

export const fetchReportPersons = (params: {
  from?: string; to?: string; squadId?: number; employmentType?: string;
  page?: number; pageSize?: number;
}) =>
  api.get<ReportPage<PersonReportRow>>("/reports/persons", { params }).then((r) => r.data);

export const fetchReportSquads = (params: {
  from?: string; to?: string; squadId?: number; roleType?: string;
  page?: number; pageSize?: number;
}) =>
  api.get<ReportPage<SquadReportRow>>("/reports/squads", { params }).then((r) => r.data);
