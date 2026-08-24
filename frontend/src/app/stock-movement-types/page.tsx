"use client";

import { useEffect, useState } from "react";

type MovementType = {
  movement_type_id: number;
  movement_type: string;
  description: string;
  effect: "SUMA" | "RESTA" | "TRANSFERENCIA";
  active: boolean;
};

export default function StockMovementTypesPage() {
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newType, setNewType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEffect, setNewEffect] =
  useState<"SUMA" | "RESTA" | "TRANSFERENCIA">("SUMA");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function loadTypes() {
    try {
      const response = await fetch(
        "http://localhost:3001/api/movement-types"
      );

      if (!response.ok) {
        throw new Error("Error al cargar los tipos");
      }

      const data = await response.json();

      setMovementTypes(data);
    } catch {
      setIsError(true);
      setMessage("No se pudieron cargar los tipos de movimiento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTypes();
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  async function handleCreate() {
    setMessage("");
    setIsError(false);

    if (!newType.trim()) {
      setIsError(true);
      setMessage("Debe indicar el nombre del tipo");
      return;
    }

    if (!newDescription.trim()) {
      setIsError(true);
      setMessage("Debe indicar una descripción");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3001/api/movement-types",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            movementType: newType,
            description: newDescription,
            effect: newEffect,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Error al crear el tipo de movimiento"
        );
      }

      setIsError(false);
      setMessage("Tipo de movimiento creado correctamente");

      setNewType("");
      setNewDescription("");
      setNewEffect("SUMA");
      setShowCreateForm(false);

      await loadTypes();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Error al crear el tipo de movimiento"
      );
    }
  }

  async function handleUpdate(type: MovementType) {
    try {
      const response = await fetch(
        `http://localhost:3001/api/movement-types/${type.movement_type_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: type.description,
            effect: type.effect,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar");
      }

      setIsError(false);
      setMessage("Tipo de movimiento actualizado correctamente");

      await loadTypes();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Error al actualizar el tipo"
      );
    }
  }

  async function handleToggle(type: MovementType) {
    try {
      const response = await fetch(
        `http://localhost:3001/api/movement-types/${type.movement_type_id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: !type.active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cambiar el estado");
      }

      setIsError(false);

      setMessage(
        type.active
          ? "Tipo de movimiento desactivado"
          : "Tipo de movimiento activado"
      );

      await loadTypes();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Error al cambiar el estado"
      );
    }
  }

  function updateLocalType(
    id: number,
    field: "description" | "effect",
    value: string
  ) {
    setMovementTypes((currentTypes) =>
      currentTypes.map((type) =>
        type.movement_type_id === id
          ? {
              ...type,
              [field]: value,
            }
          : type
      )
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#26333B]">
        Cargando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F4EC] px-8 py-8 text-[#26333B]">
      <div className="mx-auto max-w-6xl">
        {/* ENCABEZADO */}
        <div className="mb-8 flex items-start justify-between gap-5">
          <div>
            <h1
              className="text-4xl"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              Tipos de movimiento
            </h1>

            <p className="mt-2 text-sm text-[#26333B]/55">
              Configure los tipos de movimiento y su efecto sobre el stock.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="rounded bg-[#26333B] px-5 py-3 font-medium text-[#F4EFE4] transition hover:bg-[#34434C]"
          >
            + Nuevo tipo
          </button>
        </div>

        {/* FORMULARIO NUEVO TIPO */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-xl rounded-xl border border-[#CBA45C]/60 bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2
                  className="text-2xl"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  Nuevo tipo de movimiento
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewType("");
                    setNewDescription("");
                    setNewEffect("SUMA");
                  }}
                  className="text-2xl text-[#26333B]/40 transition hover:text-[#26333B]"
                >
                  ×
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs tracking-[0.18em] text-[#26333B]/50">
                    TIPO
                  </label>

                  <input
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="Ej. DEVOLUCIÓN"
                    className="w-full rounded border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs tracking-[0.18em] text-[#26333B]/50">
                    DESCRIPCIÓN
                  </label>

                  <input
                    value={newDescription}
                    onChange={(e) =>
                      setNewDescription(e.target.value)
                    }
                    placeholder="Ej. Devolución de mercadería al depósito"
                    className="w-full rounded border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs tracking-[0.18em] text-[#26333B]/50">
                    EFECTO SOBRE EL STOCK
                  </label>

                  <select
                    value={newEffect}
                    onChange={(e) =>
                      setNewEffect(
                        e.target.value as
                          | "SUMA"
                          | "RESTA"
                          | "TRANSFERENCIA"
                      )
                    }
                    className="w-full rounded border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                  >
                    <option value="SUMA">Suma stock (+)</option>
                    <option value="RESTA">Resta stock (-)</option>
                    <option value="TRANSFERENCIA">
                      Resta en origen / Suma en destino
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewType("");
                    setNewDescription("");
                    setNewEffect("SUMA");
                  }}
                  className="rounded border border-[#26333B]/20 bg-white px-5 py-2.5 transition hover:bg-[#26333B]/5"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded bg-[#26333B] px-5 py-2.5 font-medium text-white transition hover:bg-[#34434C]"
                >
                  Crear tipo
                </button>
              </div>
            </div>
          </div>
        )}
        {/* LISTADO */}
        <div className="space-y-4">
          {movementTypes.map((type) => (
            <div
              key={type.movement_type_id}
              className="rounded-lg border border-[#26333B]/15 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                    }}
                  >
                    {type.movement_type}
                  </h2>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      type.active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {type.active ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(type)}
                  className={`rounded border px-4 py-2 text-sm font-medium transition ${
                    type.active
                      ? "border-red-300 text-red-600 hover:bg-red-50"
                      : "border-green-300 text-green-700 hover:bg-green-50"
                  }`}
                >
                  {type.active ? "Desactivar" : "Activar"}
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-[1fr_280px]">
                <div>
                  <label className="mb-2 block text-xs tracking-[0.18em] text-[#26333B]/50">
                    DESCRIPCIÓN
                  </label>

                  <input
                    value={type.description}
                    onChange={(e) =>
                      updateLocalType(
                        type.movement_type_id,
                        "description",
                        e.target.value
                      )
                    }
                    className="w-full rounded border border-[#26333B]/20 bg-[#FCFAF5] px-4 py-3 outline-none focus:border-[#CBA45C]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs tracking-[0.18em] text-[#26333B]/50">
                    EFECTO
                  </label>

                  <select
                    value={type.effect}
                    onChange={(e) =>
                      updateLocalType(
                        type.movement_type_id,
                        "effect",
                        e.target.value
                      )
                    }
                    className="w-full rounded border border-[#26333B]/20 bg-[#FCFAF5] px-4 py-3 outline-none focus:border-[#CBA45C]"
                  >
                    <option value="SUMA">Suma stock (+)</option>
                    <option value="RESTA">Resta stock (-)</option>
                    <option value="TRANSFERENCIA">
                      Resta en origen /Suma en destino
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => handleUpdate(type)}
                  className="rounded border border-[#CBA45C] px-5 py-2.5 font-medium text-[#9A6A1C] transition hover:bg-[#CBA45C]/10"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARTEL */}
      {message && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl border bg-white px-5 py-4 shadow-xl ${
            isError
              ? "border-red-400 text-red-700"
              : "border-[#CBA45C] text-[#26333B]"
          }`}
        >
          <p
            className={`font-semibold ${
              isError ? "text-red-700" : "text-[#9A6A1C]"
            }`}
          >
            {isError ? "Error" : "Listo"}
          </p>

          <p className="mt-1 text-sm">{message}</p>
        </div>
      )}
    </main>
  );
}