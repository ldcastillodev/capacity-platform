"use client";

import React, { useEffect } from "react";
import { CheckCircle, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSyncContext, type OpState } from "@/context/SyncContext";

const AUTO_DISMISS_MS = 4000;

const RUNNING_LABEL: Record<"sync" | "refresh", string> = {
  sync: "Syncing data…",
  refresh: "Refreshing analytics…",
};

function StatusRow({
  op,
  state,
  onDismiss,
}: {
  op: "sync" | "refresh";
  state: OpState;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (state.status !== "success") return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [state.status, onDismiss]);

  if (state.status === "idle") return null;

  return (
    <Card
      className={cn(
        "flex items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-lg animate-slide-up-fade",
        state.status === "success" && "bg-[var(--safe-bg)] text-[var(--safe)] border-[var(--safe)]",
        state.status === "error" &&
          "bg-[var(--critical-bg)] text-[var(--critical)] border-[var(--critical)]"
      )}
    >
      {state.status === "running" && <Loader2 size={16} className="animate-spin shrink-0" />}
      {state.status === "success" && <CheckCircle size={16} className="shrink-0" />}
      <span className="flex-1">
        {state.status === "running" ? RUNNING_LABEL[op] : state.message}
      </span>
      {state.status === "error" && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 hover:opacity-70">
          <X size={16} />
        </button>
      )}
    </Card>
  );
}

export function SyncStatusWidget() {
  const { sync, refresh, dismiss } = useSyncContext();

  if (sync.status === "idle" && refresh.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80">
      <StatusRow op="sync" state={sync} onDismiss={() => dismiss("sync")} />
      <StatusRow op="refresh" state={refresh} onDismiss={() => dismiss("refresh")} />
    </div>
  );
}
