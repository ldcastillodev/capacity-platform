"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, BarChart2, BookOpen, ClipboardList, Clock, FileText, LayoutDashboard, PieChart, RefreshCw, Settings, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const nav = [
  { href: "/",             icon: LayoutDashboard, label: "Overview" },
  { href: "/burn",         icon: BarChart2,        label: "Burn Rate" },
  { href: "/nonbillable",  icon: Clock,            label: "Non-Billable" },
  { href: "/consumption",  icon: PieChart,         label: "Consumption" },
  { href: "/capacity",     icon: Activity,         label: "Capacity" },
  { href: "/declarations", icon: ClipboardList,    label: "Declarations" },
  { href: "/flags",        icon: AlertTriangle,    label: "Anomaly Flags" },
  { href: "/simulator",    icon: Zap,              label: "New Client" },
  { href: "/reports",      icon: FileText,         label: "Reports" },
  { href: "/sync",         icon: RefreshCw,        label: "Sync" },
  { href: "/management",   icon: Settings,         label: "Management" },
  { href: "/help",         icon: BookOpen,         label: "How to Use" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <nav
              className="fixed top-0 left-0 bottom-0 flex flex-col bg-card border-r border-border"
              style={{ width: "var(--nav-width)" }}
            >
              <div className="px-5 pt-6 pb-6 border-b border-border">
                <img src="/favicon.svg" alt="MgS" className="h-9 block" />
                <div className="text-xs text-muted-foreground mt-1">Capacity Platform</div>
              </div>

              <div className="flex-1 px-3 py-4">
                {nav.map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors",
                        isActive
                          ? "font-semibold bg-accent text-accent-foreground"
                          : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Main content */}
            <main className="flex-1 p-8" style={{ marginLeft: "var(--nav-width)" }}>
              {children}
            </main>
          </div>
        </QueryClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
