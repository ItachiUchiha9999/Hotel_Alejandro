"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api } from "@/lib/api";
import type { FilaSaldo, Movimiento } from "@/lib/types";

/**
 * Inicio del sistema.
 *
 * Antes esta página era una copia casi literal de /articulos (35 KB duplicados,
 * con su propio estado, sus propios fetch y un switch de vista que nunca se
 * usaba). Ahora es un panel de entrada: muestra lo que hay que mirar primero y
 * lleva a cada módulo.
 */

const ACCESOS = [
  { titulo: "Stock por depósito", ruta: "/stock", detalle: "Ver existencias y mover mercadería" },
  { titulo: "Registrar movimiento", ruta: "/stock/movements/new", detalle: "Ingreso, egreso o transferencia" },
  { titulo: "Catálogo de artículos", ruta: "/articulos", detalle: "Alta y ficha de insumos" },
  { titulo: "Depósitos", ruta: "/stock/depositos", detalle: "Administrar lugares de guardado" },
];

export default function InicioPage() {
  const [saldo, setSaldo] = useState<FilaSaldo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [sinBackend, setSinBackend] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([
          api.get<FilaSaldo[]>("/stock"),
          api.get<Movimiento[]>("/stock/movimientos"),
        ]);
        setSaldo(s);
        setMovimientos(m.slice(0, 5));
      } catch {
        setSinBackend(true);
      }
    })();
  }, []);

  const bajoMinimo = saldo.filter(
    (f) => Number(f.stock_amount) < Number(f.articles.article_stock_min_general),
  );

  return (
    <>
      <PageHeader
        eyebrow="SIGH · Sistema de Gestión Hotelera"
        titulo="Hotel Alejandro I"
        descripcion="Panel de control de insumos: blancos, limpieza, amenities y frigobar."
      />

      {sinBackend && (
        <div className="mb-6">
          <InfoBox tipo="error" titulo="Sin conexión con el servidor:">
            no se pudieron cargar los datos. Verificá que el backend esté corriendo en el
            puerto configurado en NEXT_PUBLIC_API_URL.
          </InfoBox>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS.map((a) => (
          <Link
            key={a.ruta}
            href={a.ruta}
            className="rounded-xl border border-line bg-white p-5 shadow-card transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-gold"
          >
            <h2 className="font-serif text-base text-carbon">{a.titulo}</h2>
            <p className="mt-1 text-xs text-carbon/55">{a.detalle}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          titulo="Artículos bajo el mínimo"
          descripcion={
            bajoMinimo.length > 0
              ? "Conviene reponer antes de que se corte el servicio."
              : "Ningún artículo está por debajo de su stock mínimo."
          }
        >
          {bajoMinimo.length === 0 ? (
            <p className="py-6 text-center text-sm text-carbon/45">Todo en orden.</p>
          ) : (
            <Table>
              <THead>
                <TH>Artículo</TH>
                <TH>Depósito</TH>
                <TH className="text-right">Actual / Mínimo</TH>
              </THead>
              <TBody>
                {bajoMinimo.slice(0, 6).map((f) => (
                  <TR key={f.stock_id}>
                    <TD className="font-medium">{f.articles.article_name}</TD>
                    <TD className="text-xs">{f.deposit.deposit_name}</TD>
                    <TD className="text-right tabular-nums">
                      <Badge tono="alerta">
                        {Number(f.stock_amount)} / {Number(f.articles.article_stock_min_general)}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card titulo="Últimos movimientos" descripcion="Las cinco operaciones más recientes.">
          {movimientos.length === 0 ? (
            <p className="py-6 text-center text-sm text-carbon/45">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {movimientos.map((m) => (
                <li key={m.stock_movement_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-carbon">
                      {m.movement_type.movement_type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-carbon/50">
                      {m.deposit_origin?.deposit_name ?? "Proveedor"} →{" "}
                      {m.deposit_destination?.deposit_name ?? "Consumo"}
                    </p>
                  </div>
                  <span className="text-xs text-carbon/45">
                    {new Date(m.transaction_date).toLocaleDateString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
