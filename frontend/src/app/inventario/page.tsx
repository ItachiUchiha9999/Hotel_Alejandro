"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, Package, Building2, ClipboardList, Tag, ArrowRightLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";

const tabsInventario = [
  {
    value: "articulos",
    label: "Artículos",
    icon: <Package className="w-4 h-4" />,
    count: 156,
    children: (
      <div className="text-center py-12 text-neutral-500">
        <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-lg font-medium text-neutral-900 mb-1">Gestión de Artículos</h3>
        <p className="text-sm">Lista completa de artículos con stock, precios y proveedores</p>
        <Link href="/inventario/articulos">
          <Button className="mt-4" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Ir a Artículos →
          </Button>
        </Link>
      </div>
    ),
  },
  {
    value: "depositos",
    label: "Depósitos",
    icon: <Building2 className="w-4 h-4" />,
    count: 4,
    children: (
      <div className="text-center py-12 text-neutral-500">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-lg font-medium text-neutral-900 mb-1">Gestión de Depósitos</h3>
        <p className="text-sm">Ubicaciones físicas de almacenamiento y responsable</p>
        <Link href="/inventario/depositos">
          <Button className="mt-4" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Ir a Depósitos →
          </Button>
        </Link>
      </div>
    ),
  },
  {
    value: "movimientos",
    label: "Movimientos",
    icon: <ClipboardList className="w-4 h-4" />,
    count: 342,
    children: (
      <div className="text-center py-12 text-neutral-500">
        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-lg font-medium text-neutral-900 mb-1">Historial de Movimientos</h3>
        <p className="text-sm">Entradas, salidas, ajustes y transferencias</p>
        <Link href="/inventario/movimientos">
          <Button className="mt-4" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Ver Historial →
          </Button>
        </Link>
      </div>
    ),
  },
  {
    value: "categorias",
    label: "Categorías",
    icon: <Tag className="w-4 h-4" />,
    count: 12,
    children: (
      <div className="text-center py-12 text-neutral-500">
        <Tag className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-lg font-medium text-neutral-900 mb-1">Categorías de Artículos</h3>
        <p className="text-sm">Clasificación y organización del catálogo</p>
        <Link href="/inventario/categorias">
          <Button className="mt-4" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Ver Categorías →
          </Button>
        </Link>
      </div>
    ),
  },
  {
    value: "transferencias",
    label: "Transferencias",
    icon: <ArrowRightLeft className="w-4 h-4" />,
    count: 23,
    children: (
      <div className="text-center py-12 text-neutral-500">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-lg font-medium text-neutral-900 mb-1">Transferencias entre Depósitos</h3>
        <p className="text-sm">Movimientos internos entre ubicaciones</p>
        <Link href="/stock/transfers">
          <Button className="mt-4" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Ver Transferencias →
          </Button>
        </Link>
      </div>
    ),
  },
];

export default function InventarioPage() {
  const [tabActivo, setTabActivo] = useState("articulos");
  const [busqueda, setBusqueda] = useState("");

  return (
    <PageContainer>
      <PageHeader
        titulo="Inventario"
        descripcion="Gestión completa de stock, artículos y movimientos"
        acciones={
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            Nuevo artículo
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Input
          placeholder="Buscar artículos, categorías, depósitos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-72"
        />
      </div>

      {/* Tabs principales */}
      <Card>
        <Tabs
          tabs={tabsInventario}
          activeTab={tabActivo}
          onChange={setTabActivo}
          variant="default"
          fullWidth
        />
      </Card>
    </PageContainer>
  );
}