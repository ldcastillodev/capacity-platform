"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  Menu,
  PieChart,
  RefreshCw,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const nav = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/burn", icon: BarChart2, label: "Burn Rate" },
  { href: "/nonbillable", icon: Clock, label: "Non-Billable" },
  { href: "/consumption", icon: PieChart, label: "Consumption" },
  { href: "/capacity", icon: Activity, label: "Capacity" },
  { href: "/declarations", icon: ClipboardList, label: "Declarations" },
  { href: "/flags", icon: AlertTriangle, label: "Anomaly Flags" },
  { href: "/simulator", icon: Zap, label: "New Client" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/sync", icon: RefreshCw, label: "Sync" },
  { href: "/management", icon: Settings, label: "Management" },
  { href: "/help", icon: BookOpen, label: "How to Use" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      })
  );
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <QueryClientProvider client={queryClient}>
            <div className="flex min-h-screen">
              {/* Mobile backdrop */}
              {mobileNavOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                  onClick={() => setMobileNavOpen(false)}
                  aria-hidden
                />
              )}

              {/* Sidebar — fixed on desktop, off-canvas (GPU transform) on mobile */}
              <nav
                className={cn(
                  "fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-card border-r border-border w-[var(--nav-width)] transition-transform duration-200 ease-out lg:translate-x-0",
                  mobileNavOpen ? "translate-x-0" : "-translate-x-full"
                )}
              >
                <div className="flex items-start justify-between px-5 pt-6 pb-6 border-b border-border">
                  <div>
                    <img src="/favicon.svg" alt="MgS" className="h-9 block" />
                    <div className="text-xs text-muted-foreground mt-1">Capacity Platform</div>
                  </div>
                  <button
                    className="lg:hidden text-muted-foreground hover:text-foreground"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Close navigation"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
                  {nav.map(({ href, icon: Icon, label }) => {
                    const isActive =
                      href === "/"
                        ? pathname === "/"
                        : pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileNavOpen(false)}
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
              <main className="flex-1 ml-0 lg:ml-[var(--nav-width)]">
                {/* Mobile top bar with nav toggle */}
                <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-4 border-b border-border bg-card/80 backdrop-blur">
                  <button
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open navigation"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Menu size={20} />
                  </button>
                  <img src="/favicon.svg" alt="MgS" className="h-7" />
                </div>
                <div className="p-4 sm:p-6 lg:p-8">{children}</div>
              </main>
            </div>
          </QueryClientProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
