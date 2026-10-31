"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { api, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuevoHuespedPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    document_type: "DNI",
    document_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birth_date: "",
    nationality: "",
    address: "",
    observations: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      // Validar campos requeridos
      if (!formData.document_number.trim()) {
        throw new Error("El número de documento es obligatorio.");
      }
      if (!formData.first_name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }
      if (!formData.last_name.trim()) {
        throw new Error("El apellido es obligatorio.");
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error("El correo electrónico no es válido.");
      }

      const payload = {
        document_type: formData.document_type,
        document_number: formData.document_number.trim().toUpperCase(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        birth_date: formData.birth_date || null,
        nationality: formData.nationality.trim() || null,
        address: formData.address.trim() || null,
        observations: formData.observations.trim() || null,
        guest_state: true,
      };

      await api.post("/reservas/clientes", payload);
      router.push("/huespedes");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "No se pudo crear el huésped."
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Nuevo huésped"
        descripcion="Registra un nuevo huésped en el sistema"
        acciones={
          <Link href="/huespedes">
            <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Volver
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="document_type" className="block text-sm font-medium text-carbon mb-1">
                Tipo de documento *
              </label>
              <Select
                id="document_type"
                name="document_type"
                value={formData.document_type}
                onChange={handleChange}
                options={[
                  { value: "DNI", label: "DNI" },
                  { value: "PASAPORTE", label: "Pasaporte" },
                  { value: "CEDULA", label: "Cédula" },
                  { value: "LC", label: "LC" },
                  { value: "LE", label: "LE" },
                ]}
              />
            </div>
            <div>
              <label htmlFor="document_number" className="block text-sm font-medium text-carbon mb-1">
                Número de documento *
              </label>
              <Input
                id="document_number"
                name="document_number"
                value={formData.document_number}
                onChange={handleChange}
                placeholder="Ej: 12345678"
                maxLength={30}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-carbon mb-1">
                Nombre *
              </label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Ej: Juan"
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-carbon mb-1">
                Apellido *
              </label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Ej: Pérez"
                maxLength={100}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-carbon mb-1">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ej: juan.perez@email.com"
                maxLength={150}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-carbon mb-1">
                Teléfono
              </label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej: +54 11 1234-5678"
                maxLength={30}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="birth_date" className="block text-sm font-medium text-carbon mb-1">
                Fecha de nacimiento
              </label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={handleChange}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label htmlFor="nationality" className="block text-sm font-medium text-carbon mb-1">
                Nacionalidad
              </label>
              <Input
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                placeholder="Ej: Argentina"
                maxLength={60}
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-carbon mb-1">
              Dirección
            </label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Ej: Av. Corrientes 1234, CABA"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="observations" className="block text-sm font-medium text-carbon mb-1">
              Observaciones
            </label>
            <textarea
              id="observations"
              name="observations"
              value={formData.observations}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none"
              maxLength={255}
              placeholder="Notas adicionales sobre el huésped..."
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <Link href="/huespedes">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={cargando} leftIcon={cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>
              {cargando ? "Guardando..." : "Guardar huésped"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}