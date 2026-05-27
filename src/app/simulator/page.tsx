"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PlusCircle, Trash2 } from "lucide-react";
import { runSimulation, type RoleType, type SimulationResult } from "@/lib/client";

const ROLES: RoleType[] = ["frontend_dev","backend_dev","fullstack_dev","qa","devops","pm","ux","data_engineer","tech_lead","sme"];
const ROLE_LABELS: Partial<Record<RoleType, string>> = {
  frontend_dev: "Frontend Dev", backend_dev: "Backend Dev", fullstack_dev: "Fullstack Dev",
  qa: "QA", devops: "DevOps", pm: "PM", ux: "UX", data_engineer: "Data Engineer",
  tech_lead: "Tech Lead", sme: "SME",
};
const ACTION_COLOR: Record<string, string> = { available: "var(--safe)", redistribute: "var(--watch)", hire_needed: "var(--critical)" };

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, outline: "none", width: "100%", background: "var(--bg)" };

function Field({ label, children }: { label: string; children: React.ReactElement<{ style?: React.CSSProperties }> }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{label}</label>
      {React.cloneElement(children, { style: { ...inputStyle, ...children.props.style } })}
    </div>
  );
}

export default function SimulatorPage() {
  const [name, setName] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [poolHours, setPoolHours] = useState("");
  const [roles, setRoles] = useState<{ role_type: RoleType; hours: string }[]>([{ role_type: "backend_dev", hours: "" }]);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const { mutate, isPending } = useMutation({ mutationFn: runSimulation, onSuccess: (data) => setResult(data) });

  const addRole = () => setRoles((prev) => [...prev, { role_type: "qa", hours: "" }]);
  const removeRole = (i: number) => setRoles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    mutate({
      proposed_client_name: name,
      proposed_start_month: startMonth + "-01",
      proposed_pool_hours: +poolHours,
      role_breakdown: roles.filter((r) => r.hours).map((r) => ({ role_type: r.role_type, hours_per_month: +r.hours })),
    });
  };

  const valid = name && startMonth && poolHours && roles.some((r) => r.hours);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>New Client Simulator</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>Check if current capacity can absorb a new client — before committing</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 900 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 16 }}>Proposed client details</p>
          <Field label="Client name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" /></Field>
          <Field label="Start month"><input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} /></Field>
          <Field label="Monthly pool hours"><input type="number" value={poolHours} onChange={(e) => setPoolHours(e.target.value)} placeholder="120" /></Field>

          <p style={{ fontWeight: 600, margin: "20px 0 12px" }}>Role breakdown</p>
          {roles.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select value={r.role_type} onChange={(e) => setRoles((prev) => prev.map((x, idx) => idx === i ? { ...x, role_type: e.target.value as RoleType } : x))} style={inputStyle}>
                {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
              <input type="number" placeholder="hrs" value={r.hours} onChange={(e) => setRoles((prev) => prev.map((x, idx) => idx === i ? { ...x, hours: e.target.value } : x))} style={{ ...inputStyle, width: 72 }} />
              <button onClick={() => removeRole(i)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Trash2 size={15} /></button>
            </div>
          ))}
          <button onClick={addRole} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", background: "none", border: "none", fontSize: 13, marginTop: 4, cursor: "pointer" }}>
            <PlusCircle size={14} /> Add role
          </button>

          <button disabled={!valid || isPending} onClick={submit} style={{ marginTop: 24, width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#FDFDFD", fontWeight: 600, fontSize: 14, opacity: valid && !isPending ? 1 : 0.5, cursor: "pointer" }}>
            {isPending ? "Simulating…" : "Run simulation"}
          </button>
        </div>

        {result && (
          <div style={{ background: "var(--surface)", border: `2px solid ${result.feasible ? "var(--safe)" : "var(--critical)"}`, borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: result.feasible ? "var(--safe)" : "var(--critical)" }}>
                {result.feasible ? "✓ Feasible" : "✗ Hiring required"}
              </div>
            </div>
            {result.bottleneck_role && (
              <div style={{ background: "var(--critical-bg)", color: "var(--critical)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 16 }}>
                Bottleneck: <strong>{ROLE_LABELS[result.bottleneck_role]}</strong>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Role","Requested","Available","Action"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: "var(--text-muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.line_items.map((li) => (
                  <tr key={li.role_type} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 500 }}>{ROLE_LABELS[li.role_type]}</td>
                    <td style={{ padding: "10px 8px" }}>{li.requested_hours}h</td>
                    <td style={{ padding: "10px 8px" }}>{li.available_hours}h</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ color: ACTION_COLOR[li.action] ?? "var(--text)", fontWeight: 600, fontSize: 12 }}>
                        {li.action === "available" ? "Available" : li.action === "redistribute" ? "Redistribute" : `Hire ${li.ftes_to_hire} FTE`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
