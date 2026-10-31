"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Search, Inbox, FileText, Users, BedDouble, Package, AlertTriangle, Smile } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  titulo?: string; // backward compatibility
  description?: string;
  descripcion?: string; // backward compatibility
  action?: React.ReactNode;
  accion?: React.ReactNode; // backward compatibility
  className?: string;
}

const emptyStateIcons: Record<string, React.ReactNode> = {
  search: <Search className="w-12 h-12 text-neutral-300" />,
  inbox: <Inbox className="w-12 h-12 text-neutral-300" />,
  file: <FileText className="w-12 h-12 text-neutral-300" />,
  users: <Users className="w-12 h-12 text-neutral-300" />,
  room: <BedDouble className="w-12 h-12 text-neutral-300" />,
  package: <Package className="w-12 h-12 text-neutral-300" />,
  warning: <AlertTriangle className="w-12 h-12 text-warning-400" />,
  smile: <Smile className="w-12 h-12 text-neutral-300" />,
};

export function EmptyState({ icon, title, titulo, description, descripcion, action, accion, className }: EmptyStateProps) {
  const resolvedTitle = title || titulo;
  const resolvedDescription = description || descripcion;
  const resolvedAction = action || accion;

  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-4", className)}>
      <div className="mb-4 text-neutral-200">{icon || emptyStateIcons.smile}</div>
      {resolvedTitle && <h3 className="text-lg font-semibold text-neutral-900">{resolvedTitle}</h3>}
      {resolvedDescription && <p className="mt-2 text-sm text-neutral-500 max-w-sm">{resolvedDescription}</p>}
      {resolvedAction && <div className="mt-6">{resolvedAction}</div>}
    </div>
  );
}

// Preset empty states for common scenarios
export const EmptyStates = {
  noReservations: () => (
    <EmptyState
      icon={emptyStateIcons.inbox}
      title="No hay reservas"
      description="Todavía no se han registrado reservas para el período seleccionado."
    />
  ),
  noRooms: () => (
    <EmptyState
      icon={emptyStateIcons.room}
      title="No hay habitaciones"
      description="No se encontraron habitaciones que coincidan con los filtros aplicados."
    />
  ),
  noResults: (term?: string) => (
    <EmptyState
      icon={emptyStateIcons.search}
      title="Sin resultados"
      description={term ? `No se encontraron coincidencias para "${term}".` : "Intenta ajustar los filtros de búsqueda."}
    />
  ),
  noData: () => (
    <EmptyState
      icon={emptyStateIcons.file}
      title="No hay datos disponibles"
      description="No hay información para mostrar en este momento."
    />
  ),
  noGuests: () => (
    <EmptyState
      icon={emptyStateIcons.users}
      title="No hay huéspedes registrados"
      description="Registra el primer huésped para comenzar."
    />
  ),
  noStock: () => (
    <EmptyState
      icon={emptyStateIcons.package}
      title="Stock vacío"
      description="No hay artículos en el depósito seleccionado."
    />
  ),
  error: (message: string) => (
    <EmptyState
      icon={emptyStateIcons.warning}
      title="Error al cargar datos"
      description={message}
    />
  ),
};