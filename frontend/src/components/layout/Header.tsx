"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, Bell, User, LogOut, ChevronDown, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
}

export function Header({ onMenuClick, isSidebarCollapsed }: HeaderProps) {
  const pathname = usePathname();

  // Get page title from pathname
  const getPageTitle = () => {
    const paths: Record<string, string> = {
      "/": "Dashboard",
      "/reservas": "Reservas",
      "/reservas/checkin": "Check-in / Check-out",
      "/reservas/calendario": "Calendario de reservas",
      "/habitaciones": "Habitaciones",
      "/habitaciones/tipos": "Tipos de habitación",
      "/habitaciones/tarifas": "Tarifas",
      "/habitaciones/housekeeping": "Housekeeping",
      "/huespedes": "Huéspedes",
      "/inventario": "Inventario",
      "/inventario/articulos": "Artículos",
      "/inventario/depositos": "Depósitos",
      "/inventario/movimientos": "Movimientos",
      "/inventario/categorias": "Categorías",
      "/proveedores": "Proveedores",
      "/proveedores/ordenes-compra": "Órdenes de compra",
      "/proveedores/comprobantes": "Comprobantes",
      "/proveedores/ordenes-pago": "Órdenes de pago",
      "/proveedores/cuenta-corriente": "Cuenta corriente",
      "/reportes": "Reportes",
      "/configuracion": "Configuración",
    };
    return paths[pathname] || "Hotel Alejandro I";
  };

  const userMenuItems: DropdownItem[] = [
    { label: "Mi perfil", value: "profile", icon: <User className="w-4 h-4" /> },
    { label: "Configuración", value: "settings", icon: <Settings className="w-4 h-4" /> },
    { divider: true },
    { label: "Cerrar sesión", value: "logout", icon: <LogOut className="w-4 h-4" />, danger: true },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-16 bg-white border-b border-neutral-200 z-30 flex items-center justify-between px-4 transition-all duration-300",
        isSidebarCollapsed ? "left-16" : "left-64"
      )}
      role="banner"
    >
      {/* Left side - Menu button and page title */}
      <div className="flex items-center gap-4">
        <Tooltip content={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            aria-label={isSidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </Tooltip>

        <div className="hidden md:block">
          <h1 className="text-lg font-semibold text-neutral-900">{getPageTitle()}</h1>
          <p className="text-xs text-neutral-500">Sistema de Gestión Hotelera</p>
        </div>
      </div>

      {/* Right side - Actions and user menu */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Tooltip content="Notificaciones">
          <Button variant="ghost" size="icon" aria-label="Notificaciones">
            <Bell className="w-5 h-5 text-neutral-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
          </Button>
        </Tooltip>

        
        {/* User menu */}
        <Dropdown
          trigger={
            <Button variant="ghost" className="gap-2 px-3">
              <Avatar
                name="Admin Usuario"
                size="sm"
                status="online"
              />
              <span className="hidden sm:block text-sm font-medium text-neutral-700">Admin</span>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </Button>
          }
          items={userMenuItems}
          onSelect={(value) => {
            if (value === "logout") {
              // Handle logout
              localStorage.removeItem("tokenSesion");
              window.location.href = "/login";
            }
          }}
          align="right"
        />
      </div>
    </header>
  );
}