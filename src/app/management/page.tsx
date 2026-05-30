"use client";

import React, { useState } from "react";
import { SquadsTab }     from "@/components/management/SquadsTab";
import { PersonsTab }    from "@/components/management/PersonsTab";
import { ClientsTab }    from "@/components/management/ClientsTab";
import { ComponentsTab } from "@/components/management/ComponentsTab";
import { WorkforceTab }  from "@/components/management/WorkforceTab";
import { ContractsTab }  from "@/components/management/ContractsTab";
import { BillingTab }    from "@/components/management/BillingTab";
import { NonBillableTab } from "@/components/management/NonBillableTab";
import { AnalyticsTab }  from "@/components/management/AnalyticsTab";
import { ConfigTab }     from "@/components/management/ConfigTab";
import { AuditTab }      from "@/components/management/AuditTab";

type Tab = "squads" | "persons" | "clients" | "components" | "workforce" | "contracts" | "billing" | "nonbillable" | "analytics" | "config" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "squads",      label: "Squads" },
  { id: "persons",     label: "Persons" },
  { id: "clients",     label: "Clients" },
  { id: "components",  label: "Components" },
  { id: "workforce",   label: "Workforce" },
  { id: "contracts",   label: "Contracts" },
  { id: "billing",     label: "Billing" },
  { id: "nonbillable", label: "Non-Billable" },
  { id: "analytics",   label: "Analytics" },
  { id: "config",      label: "Config" },
  { id: "audit",       label: "Audit" },
];

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("squads");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Management</h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          marginBottom: 28,
          flexWrap: "wrap",
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

      {activeTab === "squads"      && <SquadsTab />}
      {activeTab === "persons"     && <PersonsTab />}
      {activeTab === "clients"     && <ClientsTab />}
      {activeTab === "components"  && <ComponentsTab />}
      {activeTab === "workforce"   && <WorkforceTab />}
      {activeTab === "contracts"   && <ContractsTab />}
      {activeTab === "billing"     && <BillingTab />}
      {activeTab === "nonbillable" && <NonBillableTab />}
      {activeTab === "analytics"   && <AnalyticsTab />}
      {activeTab === "config"      && <ConfigTab />}
      {activeTab === "audit"       && <AuditTab />}
    </div>
  );
}
