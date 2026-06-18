"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type OpStatus = "idle" | "running" | "success" | "error";

export type JiraSourceValue = "jira_na" | "jira_emea";

export interface OpState {
  status: OpStatus;
  message: string | null;
  /** which source the current sync op concerns (set by runSync) */
  source?: JiraSourceValue | null;
}

interface RunSyncParams {
  source: JiraSourceValue;
  dateFrom: string;
  dateTo: string;
}

interface RunRefreshParams {
  months: string[];
}

interface SyncContextValue {
  sync: OpState;
  refresh: OpState;
  runSync: (params: RunSyncParams) => Promise<void>;
  runRefresh: (params: RunRefreshParams) => Promise<void>;
  dismiss: (op: "sync" | "refresh") => void;
}

const idleState: OpState = { status: "idle", message: null };

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [sync, setSync] = useState<OpState>(idleState);
  const [refresh, setRefresh] = useState<OpState>(idleState);

  const runSync = useCallback(
    async ({ source, dateFrom, dateTo }: RunSyncParams) => {
      if (sync.status === "running") return;
      setSync({ status: "running", message: null, source });
      try {
        const res = await fetch("/api/admin/jobs/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, date_from: dateFrom, date_to: dateTo }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setSync({ status: "success", message: "Sync completed", source });
        } else {
          setSync({
            status: "error",
            message: data.error ?? "Sync failed. Check server logs.",
            source,
          });
        }
      } catch {
        setSync({ status: "error", message: "Network error — sync request failed.", source });
      }
    },
    [sync.status]
  );

  const runRefresh = useCallback(
    async ({ months }: RunRefreshParams) => {
      if (refresh.status === "running") return;
      setRefresh({ status: "running", message: null });
      try {
        const res = await fetch("/api/admin/jobs/analytics-refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ months }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setRefresh({ status: "success", message: "Analytics refresh complete" });
        } else {
          setRefresh({
            status: "error",
            message: data.error ?? "Refresh failed. Check server logs.",
          });
        }
      } catch {
        setRefresh({ status: "error", message: "Network error — refresh request failed." });
      }
    },
    [refresh.status]
  );

  const dismiss = useCallback((op: "sync" | "refresh") => {
    if (op === "sync") setSync(idleState);
    else setRefresh(idleState);
  }, []);

  return (
    <SyncContext.Provider value={{ sync, refresh, runSync, runRefresh, dismiss }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within a SyncProvider");
  return ctx;
}
