"use client";

import React from "react";
import ClientsReport from "@/components/reports/ClientsReport";
import PersonsReport from "@/components/reports/PersonsReport";
import SquadsReport from "@/components/reports/SquadsReport";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Hour consumption by client, person, and squad"
      />

      <Tabs defaultValue="clients">
        <TabsList className="mb-7">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="persons">Persons</TabsTrigger>
          <TabsTrigger value="squads">Squads</TabsTrigger>
        </TabsList>
        <TabsContent value="clients"><ClientsReport /></TabsContent>
        <TabsContent value="persons"><PersonsReport /></TabsContent>
        <TabsContent value="squads"><SquadsReport /></TabsContent>
      </Tabs>
    </div>
  );
}
