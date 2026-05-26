"use client";

import React, { useState } from "react";
import { SquadsTab } from "@/components/management/SquadsTab";
import { PersonsTab } from "@/components/management/PersonsTab";
import { ClientsTab } from "@/components/management/ClientsTab";
import { ComponentsTab } from "@/components/management/ComponentsTab";

type Tab = "squads" | "persons" | "clients" | "components";

const TABS: { id: Tab; label: string }[] = [
  { id: "squads",     label: "Squads" },
  { id: "persons",    label: "Persons" },
  { id: "clients",    label: "Clients" },
  { id: "components", label: "Components" },
];

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("squads");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Management</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Squads, persons, clients, and Jira component mappings
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
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              borderRadius: 0,
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "squads"     && <SquadsTab />}
      {activeTab === "persons"    && <PersonsTab />}
      {activeTab === "clients"    && <ClientsTab />}
      {activeTab === "components" && <ComponentsTab />}
    </div>
  );
}
