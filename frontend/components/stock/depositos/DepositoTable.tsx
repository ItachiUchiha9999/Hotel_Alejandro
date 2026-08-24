"use client";

import {
  Badge,
  Button,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { Deposito } from "@/lib/types";

interface Props {
  depositos: Deposito[];
  cargando: boolean;
  onCambio: () => void;
}

export function DepositoTable({ depositos, cargando, onCambio }: Props) {
  async function alternarEstado(deposito: Deposito) {
    await api.put(`/depositos/${deposito.id}`, { activo: !deposito.activo });
    onCambio();
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-2 py-2" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-bone" />
        ))}
      </div>
    );
  }

  if (depositos.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay depósitos"
        descripcion="Registrá la primera ubicación física para poder cargar artículos y movimientos de stock."
      />
    );
  }

  return (
    <Table>
      <THead>
        <TH>Nombre</TH>
        <TH>Estado</TH>
        <TH className="text-right">Acciones</TH>
      </THead>
      <TBody>
        {depositos.map((d) => (
          <TR key={d.id}>
            <TD className="font-medium">{d.nombre}</TD>
            <TD>
              <Badge tono={d.activo ? "activo" : "inactivo"}>
                {d.activo ? "Activo" : "Inactivo"}
              </Badge>
            </TD>
            <TD className="text-right">
              <Button
                variante="fantasma"
                tamano="sm"
                onClick={() => alternarEstado(d)}
              >
                {d.activo ? "Desactivar" : "Activar"}
              </Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
