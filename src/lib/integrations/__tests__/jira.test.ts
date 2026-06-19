import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SyncSource } from "@prisma/client";

// Mock boundary: jira.ts never touches Prisma directly — it calls these two
// modules (db service layer + anomaly upsert) and raw `fetch`. Mock at that
// boundary rather than the lower-level Prisma mock used by db/services tests.
vi.mock("../../db", () => ({
  syncService: {
    createSyncLog: vi.fn(),
    updateSyncLog: vi.fn(),
    upsertSyncConflictsBatch: vi.fn(),
    deleteSyncConflictsByRefs: vi.fn(),
  },
  personService: {
    listPersonsForSync: vi.fn(),
    listPersonRolesForSync: vi.fn(),
  },
  nonBillableService: {
    listSourceMappingsForSync: vi.fn(),
  },
  componentMappingService: {
    listMappingsWithContractForSync: vi.fn(),
  },
  squadService: {
    listMembershipsForSync: vi.fn(),
  },
  contractService: {
    listContractsForSync: vi.fn(),
  },
  hourRecordService: {
    sumLifetimeBillableHoursByContract: vi.fn(),
    listExistingHourRecordRefs: vi.fn(),
    createHourRecordsBatch: vi.fn(),
  },
  declarationService: {
    listDeclarationsForSync: vi.fn(),
  },
  reconciliationService: {
    listReconcilableHourRecords: vi.fn(),
    updateHourRecordHours: vi.fn(),
    softDeleteHourRecord: vi.fn(),
  },
}));

vi.mock("../../analytics/refresh", () => ({
  upsertAnomaly: vi.fn(),
}));

import {
  syncService,
  personService,
  nonBillableService,
  componentMappingService,
  squadService,
  contractService,
  hourRecordService,
  declarationService,
  reconciliationService,
} from "../../db";
import { upsertAnomaly } from "../../analytics/refresh";
import { JiraConnector, jiraConfigForSource, type JiraConnectorConfig } from "../jira";

function cast<T>(value: unknown): T {
  return value as T;
}

const config: JiraConnectorConfig = {
  baseUrl: "https://jira.example.com",
  email: "bot@example.com",
  token: "tok",
  source: "jira_na",
  instance: "na",
};

const fetchMock = vi.fn();

/** Dispatches by URL: search endpoint vs per-issue worklog fallback endpoint. */
function setFetchResponses(opts: {
  search: { issues: unknown[]; isLast?: boolean; nextPageToken?: string };
  perIssueWorklogs?: Record<string, unknown[]>;
  searchOk?: boolean;
  searchStatus?: number;
  // Reconciliation single-worklog GET, keyed by worklog id. `status` 200 returns
  // `hours`; 404 = deleted; 5xx = ambiguous error. `throws` simulates a network fault.
  worklogStatus?: Record<string, { status: number; hours?: number; throws?: boolean }>;
}) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/rest/api/3/search/jql")) {
      return Promise.resolve({
        ok: opts.searchOk ?? true,
        status: opts.searchStatus ?? 200,
        json: async () => ({ isLast: true, ...opts.search }),
      });
    }
    // Reconciliation confirming GET: /issue/{key}/worklog/{id}
    const single = url.match(/\/issue\/([^/]+)\/worklog\/([^/]+)$/);
    if (single) {
      const entry = opts.worklogStatus?.[single[2]];
      if (entry?.throws) return Promise.reject(new Error("network down"));
      const status = entry?.status ?? 404;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ timeSpentSeconds: (entry?.hours ?? 0) * 3600 }),
      });
    }
    const match = url.match(/\/issue\/([^/]+)\/worklog$/);
    if (match) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ worklogs: opts.perIssueWorklogs?.[match[1]] ?? [] }),
      });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  });
}

function makeWorklog(overrides: { id?: string; email?: string; started?: string; hours?: number }) {
  const {
    id = "10000",
    email = "alice@example.com",
    started = "2026-06-01T09:00:00.000+0000",
    hours = 4,
  } = overrides;
  return {
    id,
    author: { accountId: "acc-1", emailAddress: email },
    started,
    timeSpentSeconds: hours * 3600,
  };
}

function makeIssue(key: string, componentName: string | null, worklogs: unknown[]) {
  return {
    key,
    fields: {
      components: componentName ? [{ name: componentName }] : [],
      issuetype: { name: "Task" },
      worklog: { total: worklogs.length, maxResults: 100, worklogs },
    },
  };
}

const person = { id: 1, email: "alice@example.com" };
const role = {
  personId: 1,
  roleType: "developer",
  effectiveFrom: new Date("2026-01-01"),
  effectiveTo: null,
};
const membership = {
  personId: 1,
  squadId: 5,
  effectiveFrom: new Date("2026-01-01"),
  effectiveTo: null,
};

function activeClientMapping(overrides: {
  componentKey?: string;
  contractId?: number;
  clientId?: number;
  status?: string;
  endDate?: Date | null;
  sowEndDate?: Date | null;
  clientActive?: boolean;
  mappingEffectiveTo?: Date | null;
}) {
  const {
    componentKey = "WEBAPP",
    contractId = 100,
    clientId = 7,
    status = "active",
    endDate = null,
    sowEndDate = null,
    clientActive = true,
    mappingEffectiveTo = null,
  } = overrides;
  return {
    id: 1,
    jiraInstance: "na",
    componentKey,
    contractId,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: mappingEffectiveTo,
    contract: {
      name: `Contract ${contractId}`,
      status,
      endDate,
      sow: { clientId, endDate: sowEndDate, client: { isActive: clientActive } },
    },
  };
}

function setupDbMocks(opts: {
  persons?: unknown[];
  personRoles?: unknown[];
  memberships?: unknown[];
  nbMappings?: unknown[];
  clientMappings?: unknown[];
  contracts?: unknown[];
  consumedRows?: unknown[];
  declarations?: unknown[];
  existingRefs?: unknown[];
  reconcilableRows?: unknown[];
}) {
  vi.mocked(personService.listPersonsForSync).mockResolvedValue(cast(opts.persons ?? [person]));
  vi.mocked(personService.listPersonRolesForSync).mockResolvedValue(
    cast(opts.personRoles ?? [role])
  );
  vi.mocked(squadService.listMembershipsForSync).mockResolvedValue(
    cast(opts.memberships ?? [membership])
  );
  vi.mocked(nonBillableService.listSourceMappingsForSync).mockResolvedValue(
    cast(opts.nbMappings ?? [])
  );
  vi.mocked(componentMappingService.listMappingsWithContractForSync).mockResolvedValue(
    cast(opts.clientMappings ?? [activeClientMapping({})])
  );
  vi.mocked(contractService.listContractsForSync).mockResolvedValue(
    cast(opts.contracts ?? [{ id: 100, assignedHours: 1000, childContracts: [] }])
  );
  vi.mocked(hourRecordService.sumLifetimeBillableHoursByContract).mockResolvedValue(
    cast(opts.consumedRows ?? [])
  );
  vi.mocked(declarationService.listDeclarationsForSync).mockResolvedValue(
    cast(opts.declarations ?? [])
  );
  vi.mocked(hourRecordService.listExistingHourRecordRefs).mockResolvedValue(
    cast(opts.existingRefs ?? [])
  );
  vi.mocked(syncService.createSyncLog).mockResolvedValue(cast({ id: 1 }));
  vi.mocked(syncService.updateSyncLog).mockResolvedValue(cast(undefined));
  vi.mocked(syncService.upsertSyncConflictsBatch).mockResolvedValue(cast(undefined));
  vi.mocked(syncService.deleteSyncConflictsByRefs).mockResolvedValue(cast(undefined));
  vi.mocked(hourRecordService.createHourRecordsBatch).mockResolvedValue(cast({ count: 0 }));
  vi.mocked(reconciliationService.listReconcilableHourRecords).mockResolvedValue(
    cast(opts.reconcilableRows ?? [])
  );
  vi.mocked(reconciliationService.updateHourRecordHours).mockResolvedValue(cast(undefined));
  vi.mocked(reconciliationService.softDeleteHourRecord).mockResolvedValue(cast(undefined));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // Fixes Gap A's grace-window math (relative to "now") without faking
  // setTimeout/Promise scheduling, which pLimit's queue relies on.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("jiraConfigForSource", () => {
  it("resolves NA config from env", () => {
    vi.stubEnv("JIRA_NA_BASE_URL", "https://na.example.com");
    vi.stubEnv("JIRA_NA_EMAIL", "na-bot@example.com");
    vi.stubEnv("JIRA_NA_API_TOKEN", "na-token");

    expect(jiraConfigForSource("jira_na")).toEqual({
      baseUrl: "https://na.example.com",
      email: "na-bot@example.com",
      token: "na-token",
      source: "jira_na",
      instance: "na",
    });
  });

  it("resolves EMEA config from env", () => {
    vi.stubEnv("JIRA_EMEA_BASE_URL", "https://emea.example.com");
    vi.stubEnv("JIRA_EMEA_EMAIL", "emea-bot@example.com");
    vi.stubEnv("JIRA_EMEA_API_TOKEN", "emea-token");

    expect(jiraConfigForSource("jira_emea")).toEqual({
      baseUrl: "https://emea.example.com",
      email: "emea-bot@example.com",
      token: "emea-token",
      source: "jira_emea",
      instance: "emea",
    });
  });

  it("throws for a source with no entry in the JIRA_INSTANCES registry", () => {
    expect(() => jiraConfigForSource(cast<SyncSource>("bogus"))).toThrow(/Unknown Jira source/);
  });
});

describe("JiraConnector.sync", () => {
  describe("billable worklog routing", () => {
    it("stores an HourRecord when a worklog maps to an active contract within window", async () => {
      setupDbMocks({});
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ hours: 4 })])] },
      });

      const connector = new JiraConnector(config);
      const result = await connector.sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          personId: 1,
          squadId: 5,
          clientId: 7,
          contractId: 100,
          hours: 4,
          roleType: "developer",
          source: "jira_na",
          externalRef: "jira_na:10000",
          issueKey: "PROJ-1",
        }),
      ]);
    });
  });

  describe("non-billable worklog routing", () => {
    it("classifies by issue_key mapping (precedence over component)", async () => {
      setupDbMocks({
        nbMappings: [
          {
            identifierType: "issue_key",
            identifierValue: "NB-1",
            categoryId: 9,
            source: "jira_na",
          },
        ],
      });
      setFetchResponses({
        search: { issues: [makeIssue("NB-1", "WEBAPP", [makeWorklog({ hours: 2 })])] },
      });

      const connector = new JiraConnector(config);
      const result = await connector.sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ isNonBillable: true, nonBillableCategoryId: 9, hours: 2 }),
      ]);
    });

    it("classifies by component mapping when no issue_key mapping matches", async () => {
      setupDbMocks({
        nbMappings: [
          {
            identifierType: "component_key",
            identifierValue: "VACATION",
            categoryId: 3,
            source: "jira_na",
          },
        ],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-2", "VACATION", [makeWorklog({ hours: 8 })])] },
      });

      const connector = new JiraConnector(config);
      const result = await connector.sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ isNonBillable: true, nonBillableCategoryId: 3 }),
      ]);
    });

    it("still creates the record when no PersonRole is active on the date (counts missingRole, does not skip)", async () => {
      setupDbMocks({
        personRoles: [],
        nbMappings: [
          {
            identifierType: "issue_key",
            identifierValue: "NB-1",
            categoryId: 9,
            source: "jira_na",
          },
        ],
      });
      setFetchResponses({
        search: { issues: [makeIssue("NB-1", null, [makeWorklog({ hours: 2 })])] },
      });

      const connector = new JiraConnector(config);
      const result = await connector.sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(result.missingRole).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ isNonBillable: true, roleType: null }),
      ]);
    });
  });

  describe("missing-data conflicts (billable path)", () => {
    it("flags missingMapping and writes no HourRecord when the author email is unknown", async () => {
      setupDbMocks({ persons: [] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingMapping).toBe(1);
      expect(result.created).toBe(0);
      expect(hourRecordService.createHourRecordsBatch).not.toHaveBeenCalled();
    });

    it("flags missingMembership when no squad membership is active on the worklog date", async () => {
      setupDbMocks({ memberships: [] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingMembership).toBe(1);
      expect(result.created).toBe(0);
    });

    it("flags missingMapping when the issue has no Jira component", async () => {
      setupDbMocks({});
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", null, [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingMapping).toBe(1);
      expect(result.created).toBe(0);
    });

    it("flags missingMapping when no client mapping is effective on the worklog date", async () => {
      setupDbMocks({ clientMappings: [] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingMapping).toBe(1);
      expect(result.created).toBe(0);
    });

    it("flags missingRole and skips the record on the billable path (unlike the NB path)", async () => {
      setupDbMocks({ personRoles: [] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingRole).toBe(1);
      expect(result.created).toBe(0);
      expect(hourRecordService.createHourRecordsBatch).not.toHaveBeenCalled();
    });
  });

  describe("BR-10 multi-membership declaration routing", () => {
    const twoMemberships = [
      { personId: 1, squadId: 5, effectiveFrom: new Date("2026-01-01"), effectiveTo: null },
      { personId: 1, squadId: 6, effectiveFrom: new Date("2026-02-01"), effectiveTo: null },
    ];

    it("routes to the squad resolved by the month's role declaration", async () => {
      setupDbMocks({
        memberships: twoMemberships,
        declarations: [{ contractId: 100, squadId: 6, month: new Date(Date.UTC(2026, 5, 1)) }],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ hours: 4 })])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      // hours/roleType must come from the worklog/PersonRole, never the declaration row.
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ squadId: 6, hours: 4, roleType: "developer" }),
      ]);
    });

    it("flags missingDeclaration and raises an anomaly when no declaration resolves the contract's squad", async () => {
      setupDbMocks({ memberships: twoMemberships, declarations: [] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingDeclaration).toBe(1);
      expect(result.created).toBe(0);
      expect(upsertAnomaly).toHaveBeenCalledWith(
        7,
        expect.any(Date),
        null,
        "missing_data",
        "high",
        expect.any(String)
      );
    });

    it("flags missingDeclaration when the declared squad isn't one of the person's active memberships", async () => {
      setupDbMocks({
        memberships: twoMemberships,
        declarations: [{ contractId: 100, squadId: 99, month: new Date(Date.UTC(2026, 5, 1)) }],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.missingDeclaration).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  describe("inactive-target guard + Gap A grace window", () => {
    it("rejects a worklog on a contract closed well past the grace window", async () => {
      setupDbMocks({
        clientMappings: [
          activeClientMapping({ status: "closed", endDate: new Date("2026-04-01") }),
        ],
      });
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ started: "2026-03-20T09:00:00.000+0000" }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-03-01", "2026-03-31");

      expect(result.inactiveTarget).toBe(1);
      expect(result.created).toBe(0);
      expect(upsertAnomaly).toHaveBeenCalled();
    });

    it("accepts a backdated worklog on a contract closed within the 14-day grace window (Gap A)", async () => {
      setupDbMocks({
        clientMappings: [
          activeClientMapping({ status: "closed", endDate: new Date("2026-06-10") }),
        ],
      });
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ started: "2026-06-05T09:00:00.000+0000" }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(result.inactiveTarget).toBe(0);
    });

    it('accepts a worklog when status is stale "closed" but endDate was extended past today (Gap-A guard covers Gap C\'s reopen case)', async () => {
      setupDbMocks({
        clientMappings: [
          activeClientMapping({ status: "closed", endDate: new Date("2026-12-31") }),
        ],
      });
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ started: "2026-06-05T09:00:00.000+0000" }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(result.inactiveTarget).toBe(0);
    });

    it("rejects a worklog dated after the contract's endDate even when status is active", async () => {
      setupDbMocks({
        clientMappings: [
          activeClientMapping({ status: "active", endDate: new Date("2026-06-10") }),
        ],
      });
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ started: "2026-06-15T09:00:00.000+0000" }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.inactiveTarget).toBe(1);
      expect(result.created).toBe(0);
    });

    it("rejects a worklog dated after the SOW's endDate", async () => {
      setupDbMocks({
        clientMappings: [activeClientMapping({ sowEndDate: new Date("2026-06-01") })],
      });
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ started: "2026-06-10T09:00:00.000+0000" }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.inactiveTarget).toBe(1);
      expect(result.created).toBe(0);
    });

    it("rejects a worklog when the client is archived", async () => {
      setupDbMocks({ clientMappings: [activeClientMapping({ clientActive: false })] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({})])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.inactiveTarget).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  describe("dedup via existingRefs", () => {
    it("skips a worklog whose externalRef already has an HourRecord", async () => {
      setupDbMocks({ existingRefs: [{ externalRef: "jira_na:10000" }] });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ id: "10000" })])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(hourRecordService.createHourRecordsBatch).not.toHaveBeenCalled();
    });
  });

  describe("Gap B extension rollover", () => {
    const baseWithExtension = [
      { id: 200, assignedHours: 10, childContracts: [{ id: 201, type: "extension" }] },
    ];

    it("splits a single worklog across base and extension when it exceeds remaining assignedHours", async () => {
      setupDbMocks({
        clientMappings: [activeClientMapping({ contractId: 200 })],
        contracts: baseWithExtension,
        consumedRows: [{ contractId: 200, _sum: { hours: 8 } }],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ hours: 5 })])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ contractId: 200, hours: 2, externalRef: "jira_na:10000" }),
        expect.objectContaining({ contractId: 201, hours: 3, externalRef: "jira_na:10000:ext" }),
      ]);
    });

    it("accumulates a running tally within one run so a later (by date) worklog rolls to the extension, regardless of input order", async () => {
      setupDbMocks({
        clientMappings: [activeClientMapping({ contractId: 200 })],
        contracts: [
          { id: 200, assignedHours: 5, childContracts: [{ id: 201, type: "extension" }] },
        ],
        consumedRows: [],
      });
      // Fed out of chronological order — sync() must sort by date before tallying.
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-2", "WEBAPP", [
              makeWorklog({ id: "20002", started: "2026-06-02T09:00:00.000+0000", hours: 4 }),
            ]),
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ id: "20001", started: "2026-06-01T09:00:00.000+0000", hours: 3 }),
            ]),
          ],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(2);
      const records = vi.mocked(hourRecordService.createHourRecordsBatch).mock.calls[0][0];
      expect(records).toEqual([
        expect.objectContaining({ externalRef: "jira_na:20001", contractId: 200, hours: 3 }),
        expect.objectContaining({ externalRef: "jira_na:20002", contractId: 200, hours: 2 }),
        expect.objectContaining({ externalRef: "jira_na:20002:ext", contractId: 201, hours: 2 }),
      ]);
    });

    it("keeps all hours on the base contract when it has no extension, even when it overruns assignedHours", async () => {
      setupDbMocks({
        clientMappings: [activeClientMapping({ contractId: 300 })],
        contracts: [{ id: 300, assignedHours: 5, childContracts: [] }],
        consumedRows: [{ contractId: 300, _sum: { hours: 50 } }],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ hours: 10 })])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(1);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ contractId: 300, hours: 10 }),
      ]);
    });
  });

  describe("batching", () => {
    it("writes more than 500 created records in 500-row slices", async () => {
      const worklogs = Array.from({ length: 501 }, (_, i) =>
        makeWorklog({ id: String(i), started: "2026-06-01T09:00:00.000+0000", hours: 1 })
      );
      setupDbMocks({});
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", worklogs)] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.created).toBe(501);
      expect(hourRecordService.createHourRecordsBatch).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(hourRecordService.createHourRecordsBatch).mock.calls;
      expect(calls[0][0]).toHaveLength(500);
      expect(calls[1][0]).toHaveLength(1);
    });
  });

  describe("sync log + result aggregation / error paths", () => {
    it("records success and aggregate counts on syncService.updateSyncLog after a clean run", async () => {
      setupDbMocks({});
      setFetchResponses({
        search: {
          issues: [
            makeIssue("PROJ-1", "WEBAPP", [
              makeWorklog({ id: "1", email: "alice@example.com" }),
              makeWorklog({ id: "2", email: "unknown@example.com" }),
            ]),
          ],
        },
      });

      await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(syncService.updateSyncLog).toHaveBeenCalledWith(1, {
        completedAt: expect.any(Date),
        success: true,
        recordsFetched: 2,
        recordsCreated: 1,
        recordsSkipped: 0,
        recordsConflicted: 1,
      });
    });

    it("throws and writes only completedAt on a Jira API error, without writing any HourRecord", async () => {
      setupDbMocks({});
      setFetchResponses({ search: { issues: [] }, searchOk: false, searchStatus: 429 });

      await expect(new JiraConnector(config).sync("2026-06-01", "2026-06-30")).rejects.toThrow(
        /Jira search error: 429/
      );

      expect(syncService.updateSyncLog).toHaveBeenCalledWith(1, { completedAt: expect.any(Date) });
      expect(hourRecordService.createHourRecordsBatch).not.toHaveBeenCalled();
    });

    it("returns an all-zero result and writes nothing when there are no worklogs", async () => {
      setupDbMocks({});
      setFetchResponses({ search: { issues: [] } });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result).toEqual({
        created: 0,
        skipped: 0,
        missingMembership: 0,
        missingRole: 0,
        missingMapping: 0,
        missingDeclaration: 0,
        inactiveTarget: 0,
        reconcileUpdated: 0,
        reconcileArchived: 0,
        reconcileSkipped: 0,
        reconcileFailed: 0,
        errors: [],
      });
      expect(hourRecordService.createHourRecordsBatch).not.toHaveBeenCalled();
      expect(syncService.upsertSyncConflictsBatch).not.toHaveBeenCalled();
    });

    it("falls back to a per-issue worklog fetch when the embedded worklog page is incomplete", async () => {
      setupDbMocks({});
      const incompleteIssue = makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ id: "1" })]);
      // total (2) exceeds the embedded worklogs array (1) => triggers fetchWorklogs fallback.
      (incompleteIssue.fields.worklog as { total: number }).total = 2;
      setFetchResponses({
        search: { issues: [incompleteIssue] },
        perIssueWorklogs: { "PROJ-1": [makeWorklog({ id: "1" }), makeWorklog({ id: "2" })] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.created).toBe(2);
    });
  });

  describe("reconciliation", () => {
    const reconcileDate = new Date("2026-06-01");

    it("updates hours in place when a still-present worklog's hours changed in Jira", async () => {
      setupDbMocks({
        existingRefs: [{ externalRef: "jira_na:10000" }], // already imported → not recreated
        reconcilableRows: [
          {
            id: 50,
            externalRef: "jira_na:10000",
            issueKey: "PROJ-1",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: {
          issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ id: "10000", hours: 6 })])],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileUpdated).toBe(1);
      expect(reconciliationService.updateHourRecordHours).toHaveBeenCalledWith(50, 6);
      expect(reconciliationService.softDeleteHourRecord).not.toHaveBeenCalled();
    });

    it("soft-deletes a worklog the confirming GET reports as 404 (deleted)", async () => {
      setupDbMocks({
        reconcilableRows: [
          {
            id: 51,
            externalRef: "jira_na:99999",
            issueKey: "PROJ-9",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: { issues: [] }, // worklog absent from the fetch
        worklogStatus: { "99999": { status: 404 } },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileArchived).toBe(1);
      expect(reconciliationService.softDeleteHourRecord).toHaveBeenCalledWith(51, "jira_deleted");
    });

    it("leaves the row untouched and counts a failure when the confirming GET 5xxs (ambiguous)", async () => {
      setupDbMocks({
        reconcilableRows: [
          {
            id: 52,
            externalRef: "jira_na:88888",
            issueKey: "PROJ-8",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: { issues: [] },
        worklogStatus: { "88888": { status: 500 } },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileFailed).toBe(1);
      expect(reconciliationService.softDeleteHourRecord).not.toHaveBeenCalled();
      expect(reconciliationService.updateHourRecordHours).not.toHaveBeenCalled();
    });

    it("treats a network fault on the confirming GET as ambiguous, never deleting", async () => {
      setupDbMocks({
        reconcilableRows: [
          {
            id: 53,
            externalRef: "jira_na:77777",
            issueKey: "PROJ-7",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: { issues: [] },
        worklogStatus: { "77777": { throws: true } },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileFailed).toBe(1);
      expect(reconciliationService.softDeleteHourRecord).not.toHaveBeenCalled();
    });

    it("soft-deletes a worklog whose hours were zeroed in Jira (effective delete)", async () => {
      setupDbMocks({
        existingRefs: [{ externalRef: "jira_na:66666" }],
        reconcilableRows: [
          {
            id: 54,
            externalRef: "jira_na:66666",
            issueKey: "PROJ-6",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: {
          issues: [makeIssue("PROJ-6", "WEBAPP", [makeWorklog({ id: "66666", hours: 0 })])],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileArchived).toBe(1);
      expect(reconciliationService.softDeleteHourRecord).toHaveBeenCalledWith(54, "jira_zeroed");
    });

    it("flags a split worklog's drift for manual review instead of auto-applying", async () => {
      setupDbMocks({
        existingRefs: [{ externalRef: "jira_na:7" }, { externalRef: "jira_na:7:ext" }],
        reconcilableRows: [
          {
            id: 60,
            externalRef: "jira_na:7",
            issueKey: "PROJ-1",
            hours: 2,
            clientId: 7,
            date: reconcileDate,
          },
          {
            id: 61,
            externalRef: "jira_na:7:ext",
            issueKey: "PROJ-1",
            hours: 3,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: { issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ id: "7", hours: 8 })])] },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileSkipped).toBe(1);
      expect(result.reconcileUpdated).toBe(0);
      expect(reconciliationService.updateHourRecordHours).not.toHaveBeenCalled();
      expect(reconciliationService.softDeleteHourRecord).not.toHaveBeenCalled();
      expect(upsertAnomaly).toHaveBeenCalledWith(
        7,
        expect.any(Date),
        null,
        "missing_data",
        "medium",
        expect.any(String)
      );
    });

    it("ignores rows belonging to another source (dual-source isolation)", async () => {
      setupDbMocks({
        reconcilableRows: [
          {
            id: 70,
            externalRef: "jira_emea:10000",
            issueKey: "PROJ-1",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({ search: { issues: [] } });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileArchived).toBe(0);
      expect(result.reconcileFailed).toBe(0);
      expect(reconciliationService.softDeleteHourRecord).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/worklog/10000"),
        expect.anything()
      );
    });

    it("makes no changes when present worklog hours match the stored record", async () => {
      setupDbMocks({
        existingRefs: [{ externalRef: "jira_na:10000" }],
        reconcilableRows: [
          {
            id: 80,
            externalRef: "jira_na:10000",
            issueKey: "PROJ-1",
            hours: 4,
            clientId: 7,
            date: reconcileDate,
          },
        ],
      });
      setFetchResponses({
        search: {
          issues: [makeIssue("PROJ-1", "WEBAPP", [makeWorklog({ id: "10000", hours: 4 })])],
        },
      });

      const result = await new JiraConnector(config).sync("2026-06-01", "2026-06-30");

      expect(result.reconcileUpdated).toBe(0);
      expect(result.reconcileArchived).toBe(0);
      expect(reconciliationService.updateHourRecordHours).not.toHaveBeenCalled();
    });
  });
});
