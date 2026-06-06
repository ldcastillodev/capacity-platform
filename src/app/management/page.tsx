"use client";

import { ClientsTab }    from "@/components/management/ClientsTab";
import { ComponentsTab } from "@/components/management/ComponentsTab";
import { WorkforceTab }  from "@/components/management/WorkforceTab";
import { ContractsTab }  from "@/components/management/ContractsTab";
import { NonBillableTab } from "@/components/management/NonBillableTab";
import { AnalyticsTab }  from "@/components/management/AnalyticsTab";
import { AuditTab }      from "@/components/management/AuditTab";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManagementPage() {
  return (
    <div>
      <PageHeader title="Management" />

      <Tabs defaultValue="clients">
        <TabsList className="mb-7 flex-wrap h-auto">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="nonbillable">Non-Billable</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="components"><ComponentsTab /></TabsContent>
        <TabsContent value="workforce"><WorkforceTab /></TabsContent>
        <TabsContent value="contracts"><ContractsTab /></TabsContent>
        <TabsContent value="nonbillable"><NonBillableTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
