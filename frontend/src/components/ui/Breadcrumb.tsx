"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
}

export function Breadcrumb({ items, className, separator = <ChevronRight className="w-4 h-4" /> }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)} aria-label="Ruta de navegación">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-neutral-400 flex-shrink-0" aria-hidden="true">
                {separator}
              </span>
            )}
            {item.current ? (
              <span
                className="font-medium text-neutral-900"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1.5"
              >
                {index === 0 && <Home className="w-4 h-4" />}
                {item.label}
              </a>
            ) : (
              <span className="text-neutral-500">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}