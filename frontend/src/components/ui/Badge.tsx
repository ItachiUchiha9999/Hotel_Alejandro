"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "info" | "outline" | "ghost" | "activo" | "inactivo" | "alerta";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  // Backward compatibility
  tono?: "activo" | "inactivo" | "alerta" | "info" | "default";
}

const badgeVariants = {
  default: "bg-neutral-100 text-neutral-700 border border-neutral-200",
  success: "bg-success-50 text-success-700 border border-success-200",
  danger: "bg-danger-50 text-danger-700 border border-danger-200",
  warning: "bg-warning-50 text-warning-700 border border-warning-200",
  info: "bg-info-50 text-info-700 border border-info-200",
  outline: "bg-transparent text-neutral-700 border border-neutral-300",
  ghost: "bg-neutral-100 text-neutral-600 border-none",
  // Old tono variants
  activo: "bg-success-50 text-success-700 border border-success-200",
  inactivo: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  alerta: "bg-warning-50 text-warning-700 border border-warning-200",
};

const badgeSizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

const dotColors = {
  default: "bg-neutral-400",
  success: "bg-success-500",
  danger: "bg-danger-500",
  warning: "bg-warning-500",
  info: "bg-info-500",
  outline: "bg-neutral-400",
  ghost: "bg-neutral-400",
  activo: "bg-success-500",
  inactivo: "bg-neutral-400",
  alerta: "bg-warning-500",
};

export function Badge({
  className,
  variant = "default",
  size = "md",
  dot = false,
  tono,
  children,
  ...props
}: BadgeProps) {
  // Support old tono prop
  const resolvedVariant = tono || variant;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border",
        badgeVariants[resolvedVariant as keyof typeof badgeVariants] || badgeVariants.default,
        badgeSizes[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[resolvedVariant as keyof typeof dotColors] || dotColors.default)} aria-hidden="true" />}
      {children}
    </span>
  );
}

// Status Badge - específico para estados de la aplicación
interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<string, { variant: BadgeProps["variant"]; label: string; dot: boolean }> = {
  DISPONIBLE: { variant: "activo", label: "Disponible", dot: true },
  OCUPADA: { variant: "danger", label: "Ocupada", dot: true },
  LIMPIEZA: { variant: "warning", label: "Limpieza", dot: true },
  MANTENIMIENTO: { variant: "info", label: "Mantenimiento", dot: true },
  FUERA_DE_SERVICIO: { variant: "outline", label: "Fuera de servicio", dot: true },
  PENDIENTE: { variant: "warning", label: "Pendiente", dot: false },
  CONFIRMADA: { variant: "activo", label: "Confirmada", dot: false },
  IN_HOUSE: { variant: "info", label: "En casa", dot: false },
  FINALIZADA: { variant: "default", label: "Finalizada", dot: false },
  CANCELADA: { variant: "danger", label: "Cancelada", dot: false },
  NO_SHOW: { variant: "danger", label: "No show", dot: false },
  BORRADOR: { variant: "ghost", label: "Borrador", dot: false },
  EMITIDA: { variant: "info", label: "Emitida", dot: false },
  APROBADA: { variant: "activo", label: "Aprobada", dot: false },
  RECIBIDA: { variant: "activo", label: "Recibida", dot: false },
  PAGADO: { variant: "activo", label: "Pagado", dot: false },
  ANULADO: { variant: "danger", label: "Anulado", dot: false },
  REGISTRADO: { variant: "default", label: "Registrado", dot: false },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: "default", label: status, dot: false };
  return <Badge variant={config.variant} size={size} dot={config.dot}>{config.label}</Badge>;
}