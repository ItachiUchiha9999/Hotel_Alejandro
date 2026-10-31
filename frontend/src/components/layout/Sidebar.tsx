"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  BedDouble,
  Users,
  Package,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Hotel,
  CreditCard,
  Truck,
  ClipboardList,
  Home,
  Building2,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
  roles?: string[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-5 h-5" /> },
  {
    label: "Reservas",
    href: "/reservas",
    icon: <Calendar className="w-5 h-5" />,
    children: [
      { label: "Todas las reservas", href: "/reservas", icon: <ClipboardList className="w-4 h-4" /> },
      { label: "Check-in / Check-out", href: "/reservas/checkin", icon: <BedDouble className="w-4 h-4" /> },
      { label: "Calendario", href: "/reservas/calendario", icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    label: "Habitaciones",
    href: "/habitaciones",
    icon: <BedDouble className="w-5 h-5" />,
    children: [
      { label: "Panel de habitaciones", href: "/habitaciones", icon: <Building2 className="w-4 h-4" /> },
      { label: "Tipos de habitación", href: "/habitaciones/tipos", icon: <BedDouble className="w-4 h-4" /> },
      { label: "Tarifas", href: "/habitaciones/tarifas", icon: <CreditCard className="w-4 h-4" /> },
      { label: "Housekeeping", href: "/habitaciones/housekeeping", icon: <Home className="w-4 h-4" /> },
    ],
  },
  { label: "Huéspedes", href: "/huespedes", icon: <Users className="w-5 h-5" /> },
  {
    label: "Inventario",
    href: "/inventario",
    icon: <Package className="w-5 h-5" />,
    children: [
      { label: "Artículos", href: "/inventario/articulos", icon: <Package className="w-4 h-4" /> },
      { label: "Depósitos", href: "/inventario/depositos", icon: <Building2 className="w-4 h-4" /> },
      { label: "Movimientos", href: "/inventario/movimientos", icon: <ClipboardList className="w-4 h-4" /> },
      { label: "Categorías", href: "/inventario/categorias", icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    label: "Proveedores",
    href: "/proveedores",
    icon: <Truck className="w-5 h-5" />,
    children: [
      { label: "Proveedores", href: "/proveedores", icon: <Truck className="w-4 h-4" /> },
      { label: "Órdenes de compra", href: "/proveedores/ordenes-compra", icon: <ClipboardList className="w-4 h-4" /> },
      { label: "Comprobantes", href: "/proveedores/comprobantes", icon: <FileText className="w-4 h-4" /> },
      { label: "Órdenes de pago", href: "/proveedores/ordenes-pago", icon: <CreditCard className="w-4 h-4" /> },
      { label: "Cuenta corriente", href: "/proveedores/cuenta-corriente", icon: <FileText className="w-4 h-4" /> },
    ],
  },
  { label: "Reportes", href: "/reportes", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "Configuración", href: "/configuracion", icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleItem = (href: string) => {
    setExpandedItems((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-neutral-200 transition-all duration-300 z-40 flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}
      aria-label="Navegación principal"
    >
      {/* Logo */}
      <div className={cn("flex items-center justify-between h-16 px-4 border-b border-neutral-200", isCollapsed && "justify-center")}>
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2" aria-label="Hotel Alejandro I - Inicio">
            <div className="w-8 h-8 rounded-lg bg-gold-400 flex items-center justify-center">
              <Hotel className="w-5 h-5 text-neutral-900" />
            </div>
            <span className="font-bold text-lg text-neutral-900">Hotel Alejandro I</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" role="navigation" aria-label="Menú principal">
        <ul className="space-y-1" role="list">
          {navigation.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              isExpanded={expandedItems.includes(item.href)}
              onToggle={() => item.children && toggleItem(item.href)}
              isCollapsed={isCollapsed}
              pathname={pathname}
            />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className={cn("p-4 border-t border-neutral-200", isCollapsed && "hidden")}>
        <div className="text-xs text-neutral-500 text-center">
          SIGH v1.0.0
        </div>
      </div>
    </aside>
  );
}

function NavItemComponent({ item, isActive, isExpanded, onToggle, isCollapsed, pathname }: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  pathname: string;
}) {
  const hasChildren = item.children && item.children.length > 0;

  if (isCollapsed) {
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            "flex items-center justify-center h-10 rounded-lg mx-1.5 transition-colors",
            isActive ? "bg-gold-50 text-gold-600" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
          )}
          title={item.label}
          aria-current={isActive ? "page" : undefined}
        >
          {item.icon}
        </Link>
        {hasChildren && isExpanded && (
          <div className="absolute left-16 top-0 bg-white border border-neutral-200 rounded-lg shadow-lg py-2 min-w-[200px] z-50 animate-fade-in">
            <ul className="space-y-1 px-2">
              {item.children!.map((child) => (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
                      pathname === child.href ? "bg-gold-50 text-gold-600" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                    )}
                  >
                    <span className="flex-shrink-0 w-4 h-4" aria-hidden="true">{child.icon}</span>
                    <span className="flex-1 truncate text-left">{child.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <li>
      {hasChildren ? (
        <>
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              isActive ? "bg-gold-50 text-gold-600" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            )}
            aria-expanded={isExpanded}
            aria-controls={`submenu-${item.href}`}
          >
            <span className="flex-shrink-0 w-5 h-5" aria-hidden="true">{item.icon}</span>
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
          </button>
          {isExpanded && (
            <ul id={`submenu-${item.href}`} className="mt-1 ml-8 space-y-1 animate-slide-down" role="list">
              {item.children!.map((child) => (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
                      pathname === child.href ? "bg-gold-50 text-gold-600" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
                    )}
                    aria-current={pathname === child.href ? "page" : undefined}
                  >
                    <span className="flex-shrink-0 w-4 h-4" aria-hidden="true">{child.icon}</span>
                    <span className="flex-1 truncate text-left">{child.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
            isActive ? "bg-gold-50 text-gold-600" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          )}
          aria-current={isActive ? "page" : undefined}
        >
          <span className="flex-shrink-0 w-5 h-5" aria-hidden="true">{item.icon}</span>
          <span className="flex-1 truncate text-left">{item.label}</span>
        </Link>
      )}
    </li>
  );
}