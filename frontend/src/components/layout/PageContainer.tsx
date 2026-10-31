"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { usePathname } from "next/navigation";

interface PageContainerProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function PageContainer({ children, breadcrumbs, className }: PageContainerProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Persist sidebar state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setIsSidebarCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  const sidebarWidth = isSidebarCollapsed ? "w-16" : "w-64";
  const headerLeft = isSidebarCollapsed ? "left-16" : "left-64";
  const contentMargin = isSidebarCollapsed ? "ml-16" : "ml-64";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Header */}
      <Header
        onMenuClick={() => {
          if (window.innerWidth < 1024) {
            setIsMobileSidebarOpen(!isMobileSidebarOpen);
          } else {
            setIsSidebarCollapsed(!isSidebarCollapsed);
          }
        }}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          contentMargin,
          "lg:ml-64"
        )}
        role="main"
      >
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="hidden lg:block px-6 py-4 border-b border-neutral-100">
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}

        {/* Mobile breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="lg:hidden px-4 py-3 border-b border-neutral-100">
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}

        {/* Page content */}
        <div className={cn("p-4 lg:p-6", className)}>
          {children}
        </div>
      </main>
    </div>
  );
}

// Layout wrapper for pages that don't need sidebar (login, etc.)
export function SimpleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <main className="flex-1 p-4 lg:p-8" role="main">
        {children}
      </main>
    </div>
  );
}