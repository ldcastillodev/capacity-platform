"use client";

import React, { useState } from "react";
import ClientsReport from "@/components/reports/ClientsReport";
import PersonsReport from "@/components/reports/PersonsReport";
import SquadsReport from "@/components/reports/SquadsReport";

type Tab = "clients" | "persons" | "squads";

const TABS: { id: Tab; label: string }[] = [
  { id: "clients", label: "Clients" },
  { id: "persons", label: "Persons" },
  { id: "squads",  label: "Squads" },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("clients");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Reports</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Hour consumption by client, person, and squad
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          marginBottom: 28,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "9px 22px",
              border: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color:
                activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              borderBottom: `2px solid ${
                activeTab === tab.id ? "var(--primary)" : "transparent"
              }`,
              marginBottom: -1,
              borderRadius: 0,
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "clients" && <ClientsReport />}
      {activeTab === "persons" && <PersonsReport />}
      {activeTab === "squads"  && <SquadsReport />}
    </div>
  );
}
