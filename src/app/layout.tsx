"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, BarChart2, BookOpen, ClipboardList, Clock, FileText, LayoutDashboard, PieChart, RefreshCw, Settings, Zap } from "lucide-react";
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
      <body style={{ minHeight: "100vh" }}>
        <QueryClientProvider client={queryClient}>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <nav
              style={{
                width: "var(--nav-width)",
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                padding: "24px 0",
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--primary)" }}>
                  Capacity
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                  Managed Services
                </div>
              </div>

              <div style={{ padding: "16px 12px", flex: 1 }}>
                {nav.map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: 8,
                        marginBottom: 2,
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? "var(--primary-light)" : "transparent",
                        color: isActive ? "var(--primary)" : "var(--text-muted)",
                        transition: "all 0.15s",
                        textDecoration: "none",
                        fontSize: 14,
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Main content */}
            <main
              style={{
                marginLeft: "var(--nav-width)",
                flex: 1,
                padding: "32px",
                maxWidth: "calc(100vw - var(--nav-width))",
              }}
            >
              {children}
            </main>
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
