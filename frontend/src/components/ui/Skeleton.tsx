"use client";

import { cn } from "@/lib/utils";

/**
 * Componentes de skeleton loading para estados de carga animados.
 * Usan animaciones CSS puras para máximo rendimiento.
 */

export function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-full animate-pulse bg-neutral-200 rounded"
          style={{
            width: i === lines - 1 ? "60%" : "100%",
            minWidth: "100px",
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  className,
  showHeader = true,
  showContent = true,
  contentLines = 4,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { showHeader?: boolean; showContent?: boolean; contentLines?: number }) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white p-5 animate-pulse", className)} {...props}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-48 bg-neutral-200 rounded" />
          <div className="h-8 w-20 bg-neutral-200 rounded" />
        </div>
      )}
      {showContent && (
        <SkeletonText lines={contentLines} />
      )}
    </div>
  );
}

export function SkeletonKPI({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white p-5 shadow-sm animate-pulse", className)} {...props}>
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-32 bg-neutral-200 rounded mb-2" />
          <div className="h-8 w-40 bg-neutral-200 rounded" />
          <div className="h-3 w-48 bg-neutral-200 rounded mt-1" />
        </div>
        <div className="h-11 w-11 rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div className={cn("overflow-x-auto", className)} {...props}>
      <table className="w-full table-fixed animate-pulse">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="w-auto bg-neutral-100 px-4 py-3 text-left">
                <div className="h-3 w-20 bg-neutral-200 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-t border-neutral-100 hover:bg-neutral-50/50">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <div className="h-4 w-24 bg-neutral-200 rounded" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonChart({
  className,
  height = 200,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { height?: number }) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white p-5 animate-pulse", className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 bg-neutral-200 rounded" />
        <div className="h-8 w-24 bg-neutral-200 rounded" />
      </div>
      <div
        className="h-[200px] bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-100 rounded-lg animate-pulse"
        style={{ height }}
      />
      <div className="mt-3 flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-neutral-300" />
            <div className="h-3 w-20 bg-neutral-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({
  items = 5,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { items?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 bg-white animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-12 w-12 rounded-lg bg-neutral-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-neutral-200 rounded" />
            <div className="h-4 w-64 bg-neutral-200 rounded" />
          </div>
          <div className="h-8 w-24 bg-neutral-200 rounded" />
        </div>
      ))}
    </div>
  );
}

interface PageSkeletonProps {
  className?: string;
  title?: boolean;
  kpiCount?: number;
  showTable?: boolean;
  showChart?: boolean;
  children?: React.ReactNode;
}

export function PageSkeleton({
  className,
  title = true,
  kpiCount = 4,
  showTable = true,
  showChart = true,
  children,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-3 w-24 bg-neutral-200 rounded animate-pulse" />
            <div className="h-8 w-64 bg-neutral-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-neutral-200 rounded animate-pulse" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {showChart && <SkeletonChart />}
        {showTable && <SkeletonTable rows={6} columns={5} />}
      </div>
    </div>
  );
}

// Animaciones de entrada/salida para transiciones suaves
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: "easeOut" },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" },
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25, ease: "easeOut" },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: "easeOut" },
};