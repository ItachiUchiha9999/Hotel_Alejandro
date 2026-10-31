/**
 * Utility functions for the application.
 */

import { clsx, type ClassValue } from "clsx";

/**
 * Utility to merge class names with clsx.
 * Handles conditional classes, arrays, objects, etc.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a number as currency (ARS)
 */
export function formatCurrency(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

/**
 * Format a number with compact notation (e.g., 1.2K, 1.5M)
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a date as short string (dd/MM/yyyy)
 */
export function formatDate(date: string | Date, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format a date as long string (dd MMMM yyyy)
 */
export function formatDateLong(date: string | Date, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format a date as short month (MMM)
 */
export function formatMonth(date: string | Date, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
  }).format(new Date(date));
}

/**
 * Calculate percentage change between two numbers
 */
export function calculateChange(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "Sin cambios" : "Nuevo";
  }
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}