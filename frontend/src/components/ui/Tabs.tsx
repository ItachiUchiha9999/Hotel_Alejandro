"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
  children?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (value: string) => void;
  variant?: "default" | "pills" | "underline";
  fullWidth?: boolean;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = "default", fullWidth = false, className }: TabsProps) {
  const variants = {
    default: "border-b border-neutral-200",
    pills: "gap-1 bg-neutral-100 p-1 rounded-lg",
    underline: "border-b border-neutral-200",
  };

  const tabVariants = {
    default: `
      px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all
      data-[state=active]:border-gold-400 data-[state=active]:text-gold-600
      data-[state=inactive]:border-transparent data-[state=inactive]:text-neutral-500
      hover:data-[state=inactive]:text-neutral-700
    `,
    pills: `
      px-4 py-2 text-sm font-medium rounded-md transition-all
      data-[state=active]:bg-white data-[state=active]:text-gold-600 data-[state=active]:shadow-sm
      data-[state=inactive]:text-neutral-600 hover:data-[state=inactive]:text-neutral-900
    `,
    underline: `
      px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all
      data-[state=active]:border-gold-400 data-[state=active]:text-gold-600
      data-[state=inactive]:border-transparent data-[state=inactive]:text-neutral-500
      hover:data-[state=inactive]:text-neutral-700
    `,
  };

  return (
    <div className={cn("w-full", className)} role="tablist" aria-label="Pestañas">
      <div
        className={cn(
          "flex flex-wrap",
          fullWidth && "w-full",
          variants[variant]
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            aria-controls={`panel-${tab.value}`}
            id={`tab-${tab.value}`}
            onClick={() => !tab.disabled && onChange(tab.value)}
            disabled={tab.disabled}
            data-state={activeTab === tab.value ? "active" : "inactive"}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2",
              tabVariants[variant],
              tab.disabled && "opacity-50 cursor-not-allowed",
              fullWidth && "flex-1 justify-center"
            )}
          >
            {tab.icon && <span className="w-4 h-4 flex-shrink-0" aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.badge && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-700 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={`panel-${tab.value}`}
          role="tabpanel"
          id={`panel-${tab.value}`}
          aria-labelledby={`tab-${tab.value}`}
          hidden={activeTab !== tab.value}
          className="mt-4 animate-fade-in"
        >
          {activeTab === tab.value && tab.children}
        </div>
      ))}
    </div>
  );
}