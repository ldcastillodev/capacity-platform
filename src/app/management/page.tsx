"use client";

import { ClientsTab } from "@/components/management/ClientsTab";
import { ComponentsTab } from "@/components/management/ComponentsTab";
import { WorkforceTab } from "@/components/management/WorkforceTab";
import { DeclarationsTab } from "@/components/management/DeclarationsTab";
import { NonBillableTab } from "@/components/management/NonBillableTab";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function ManagementPage() {
  return (
    <TooltipProvider>
      <PageHeader title="Management" />

      <Tabs defaultValue="clients">
        <TabsList className="mb-7 flex-wrap h-auto">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="declarations">Declarations</TabsTrigger>
          <TabsTrigger value="nonbillable">Non-Billable</TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="components">
          <ComponentsTab />
        </TabsContent>
        <TabsContent value="workforce">
          <WorkforceTab />
        </TabsContent>
        <TabsContent value="declarations">
          <DeclarationsTab />
        </TabsContent>
        <TabsContent value="nonbillable">
          <NonBillableTab />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
