"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, InfoBox } from "@/components/ui";
import { DepositoForm } from "@/components/stock/depositos/DepositoForm";
import { api, ApiError } from "@/lib/api";
import type { Deposito } from "@/lib/types";

export default function EditarDepositoPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [deposito, setDeposito] = useState<Deposito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setDeposito(await api.get<Deposito>(`/depositos/${id}`));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el depósito.");
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Editar depósito"
        descripcion=""
      />

      <Card>
        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando…</p>
        ) : error ? (
          <InfoBox tipo="error">{error}</InfoBox>
        ) : deposito ? (
          <DepositoForm deposito={deposito} />
        ) : null}
      </Card>
    </>
  );
}
