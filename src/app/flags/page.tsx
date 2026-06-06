"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { fetchClients, fetchFlags, resolveFlag } from "@/lib/client";

const SEVERITY_COLOR: Record<string, string> = {
  low: "var(--safe)",
  medium: "var(--watch)",
  high: "var(--warning)",
  critical: "var(--critical)",
};

const FLAG_LABELS: Record<string, string> = {
  spike: "Unusual Spike",
  underuse: "Underuse",
  pace_risk: "Pace Risk",
  underburn_risk: "Underburn Risk",
  role_substitution: "Role Substitution",
  missing_data: "Missing Data",
};

export default function FlagsPage() {
  const qc = useQueryClient();
  const [resolving, setResolving] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const { data: flags, isLoading } = useQuery({
    queryKey: ["flags"],
    queryFn: () => fetchFlags({ open_only: true }),
  });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));

  const { mutate: resolve } = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => resolveFlag(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flags"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setResolving(null);
      setNote("");
    },
  });

  if (isLoading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Anomaly Flags</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          {flags?.length ?? 0} open flag{flags?.length !== 1 ? "s" : ""} requiring attention
        </p>
      </div>

      {(!flags || flags.length === 0) && (
        <div style={{ background: "var(--safe-bg)", border: "1px solid #bbf7d0", borderRadius: 12, padding: 24, color: "var(--safe)", fontWeight: 500 }}>
          All clear — no open flags this month.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(flags ?? []).map((f) => (
          <div key={f.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{
                    background: SEVERITY_COLOR[f.severity] + "20",
                    color: SEVERITY_COLOR[f.severity],
                    padding: "2px 10px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}>
                    {f.severity}
                  </span>
                  <span style={{ fontWeight: 600 }}>{FLAG_LABELS[f.flag_type] ?? f.flag_type}</span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
                  {clientMap[f.client_id] ?? `Client ${f.client_id}`}
                  {f.role_type && ` · ${f.role_type}`}
                  {" · "}
                  {new Date(f.detected_at).toLocaleDateString()}
                </div>
                {f.explanation && (
                  <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}>{f.explanation}</div>
                )}
              </div>

              <button
                onClick={() => setResolving(resolving === f.id ? null : f.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
              >
                <CheckCircle size={14} />
                Resolve
              </button>
            </div>

            {resolving === f.id && (
              <div style={{ marginTop: 14, padding: 14, background: "var(--bg)", borderRadius: 8, display: "flex", gap: 10 }}>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Resolution note…"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, outline: "none" }}
                />
                <button
                  disabled={!note.trim()}
                  onClick={() => resolve({ id: f.id, note })}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#FDFDFD", fontSize: 13, fontWeight: 600, opacity: note.trim() ? 1 : 0.5, cursor: "pointer" }}
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
