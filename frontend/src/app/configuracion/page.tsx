"use client";

import { useState, type ReactNode } from "react";
import {
  Settings,
  UserCog,
  Shield,
  Bell,
  Palette,
  Database,
  Key,
  Globe,
  Save,
  Loader2,
  Download,
  ArrowRightLeft,
  CalendarCheck,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectOption } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";

/* -------------------------------------------------------------------------- */
/*  Datos                                                                     */
/* -------------------------------------------------------------------------- */

const opcionesIdioma: SelectOption[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const opcionesMoneda: SelectOption[] = [
  { value: "ARS", label: "Peso Argentino (ARS)" },
  { value: "USD", label: "Dólar Americano (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

const opcionesZonaHoraria: SelectOption[] = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Mexico_City", label: "Ciudad de México (GMT-6)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/Santiago", label: "Santiago (GMT-4)" },
];

const canalesNotificacion = ["Email", "SMS", "Push (navegador)", "Webhook", "Slack"];
const canalesActivosPorDefecto = ["Email", "Push (navegador)"];

const eventosNotificacion = [
  "Nueva reserva",
  "Check-in realizado",
  "Check-out realizado",
  "Cancelación de reserva",
  "No-show detectado",
  "Stock bajo",
  "Mantenimiento programado",
  "Pago recibido",
  "Factura generada",
];

const coloresAcento = [
  { valor: "#e3a828", nombre: "Dorado" },
  { valor: "#2563eb", nombre: "Azul" },
  { valor: "#16a34a", nombre: "Verde" },
  { valor: "#dc2626", nombre: "Rojo" },
  { valor: "#9333ea", nombre: "Violeta" },
  { valor: "#ea580c", nombre: "Naranja" },
];

const temas = [
  { value: "claro", label: "Modo claro", desc: "Tema predeterminado" },
  { value: "oscuro", label: "Modo oscuro", desc: "Tema oscuro forzado" },
  { value: "sistema", label: "Sistema", desc: "Seguir preferencia del SO" },
];

type EstadoIntegracion = "conectado" | "desconectado" | "configurado";

const integraciones: { nombre: string; estado: EstadoIntegracion; icon: string }[] = [
  { nombre: "Booking.com", estado: "conectado", icon: "🏨" },
  { nombre: "Airbnb", estado: "desconectado", icon: "🏠" },
  { nombre: "Expedia", estado: "conectado", icon: "✈️" },
  { nombre: "MercadoPago", estado: "conectado", icon: "💳" },
  { nombre: "AFIP (Facturación)", estado: "configurado", icon: "📄" },
  { nombre: "Google Calendar", estado: "desconectado", icon: "📅" },
  { nombre: "WhatsApp Business", estado: "conectado", icon: "💬" },
  { nombre: "SendGrid (Email)", estado: "configurado", icon: "📧" },
];

const etiquetaEstado: Record<EstadoIntegracion, string> = {
  conectado: "Conectado",
  configurado: "Configurado",
  desconectado: "Desconectado",
};

const varianteEstado: Record<EstadoIntegracion, "success" | "info" | "default"> = {
  conectado: "success",
  configurado: "info",
  desconectado: "default",
};

/* -------------------------------------------------------------------------- */
/*  Helpers de layout (un solo lugar para controlar los espacios)             */
/* -------------------------------------------------------------------------- */

/** Contenedor de cada tab: da aire respecto al borde de la Card. */
function TabPanel({ children }: { children: ReactNode }) {
  return <div className="p-6 space-y-6">{children}</div>;
}

/** Sección con título + icono. La separación entre secciones la pone TabPanel. */
function Seccion({
  titulo,
  icon,
  bordeSuperior = false,
  children,
}: {
  titulo: string;
  icon: ReactNode;
  bordeSuperior?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={bordeSuperior ? "border-t border-neutral-200 pt-6" : undefined}>
      <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        {icon}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Label + control con separación consistente. */
function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** Fila título/descripción + switch, con label asociado para accesibilidad. */
function FilaSwitch({
  id,
  titulo,
  descripcion,
  defaultChecked = false,
  tarjeta = false,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  defaultChecked?: boolean;
  tarjeta?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        tarjeta ? "p-3 bg-neutral-50 rounded" : ""
      }`}
    >
      <label htmlFor={id} className="cursor-pointer min-w-0">
        <p className="font-medium text-neutral-900 text-sm">{titulo}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{descripcion}</p>
      </label>
      <div className="shrink-0">
        <Switch id={id} defaultChecked={defaultChecked} />
      </div>
    </div>
  );
}

const checkboxClass = "rounded border-neutral-300 text-gold-600 focus:ring-gold-400";

/* -------------------------------------------------------------------------- */
/*  Página                                                                    */
/* -------------------------------------------------------------------------- */

export default function ConfiguracionPage() {
  const [tabActivo, setTabActivo] = useState("general");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [tema, setTema] = useState("claro");
  const [acento, setAcento] = useState("#e3a828");

  const handleGuardar = async () => {
    setGuardando(true);
    setGuardado(false);
    // TODO: reemplazar por la llamada real a la API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  const tabsConfiguracion = [
    {
      value: "general",
      label: "General",
      icon: <Settings className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Información del Hotel" icon={<Settings className="w-4 h-4 text-gold-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Campo label="Nombre del hotel" htmlFor="nombreHotel">
                <Input id="nombreHotel" defaultValue="Hotel Alejandro I" placeholder="Nombre del establecimiento" />
              </Campo>
              <Campo label="Dirección" htmlFor="direccionHotel">
                <Input id="direccionHotel" defaultValue="Av. Principal 123, Ciudad" placeholder="Dirección completa" />
              </Campo>
              <Campo label="Teléfono" htmlFor="telefonoHotel">
                <Input id="telefonoHotel" type="tel" defaultValue="+54 11 1234-5678" placeholder="Teléfono de contacto" />
              </Campo>
              <Campo label="Email" htmlFor="emailHotel">
                <Input id="emailHotel" type="email" defaultValue="info@hotelalejandro.com" placeholder="Email institucional" />
              </Campo>
              <Campo label="CUIT" htmlFor="cuitHotel">
                <Input id="cuitHotel" defaultValue="30-12345678-9" placeholder="XX-XXXXXXXX-X" />
              </Campo>
              <Campo label="Página web" htmlFor="webHotel">
                <Input id="webHotel" type="url" defaultValue="https://hotelalejandro.com" placeholder="https://" />
              </Campo>
            </div>
          </Seccion>

          <Seccion titulo="Localización e Idioma" icon={<Globe className="w-4 h-4 text-gold-600" />} bordeSuperior>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <Campo label="Idioma por defecto" htmlFor="idioma">
                <Select id="idioma" defaultValue="es" options={opcionesIdioma} />
              </Campo>
              <Campo label="Moneda" htmlFor="moneda">
                <Select id="moneda" defaultValue="ARS" options={opcionesMoneda} />
              </Campo>
              <Campo label="Zona horaria" htmlFor="zonaHoraria">
                <Select id="zonaHoraria" defaultValue="America/Argentina/Buenos_Aires" options={opcionesZonaHoraria} />
              </Campo>
            </div>
          </Seccion>

          <Seccion
            titulo="Configuración de Reservas"
            icon={<CalendarCheck className="w-4 h-4 text-gold-600" />}
            bordeSuperior
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <FilaSwitch
                id="checkInAuto"
                titulo="Check-in automático"
                descripcion="Permitir check-in online 24h antes"
                defaultChecked
              />
              <FilaSwitch
                id="checkOutExpress"
                titulo="Check-out express"
                descripcion="Habilitar check-out sin pasar por recepción"
                defaultChecked
              />
              <FilaSwitch
                id="sobreventa"
                titulo="Sobreventa controlada"
                descripcion="Permitir sobreventa hasta 10%"
              />
              <FilaSwitch
                id="confirmacionEmail"
                titulo="Confirmación por email"
                descripcion="Enviar confirmación automática al reservar"
                defaultChecked
              />
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
    {
      value: "usuarios",
      label: "Usuarios y Roles",
      icon: <UserCog className="w-4 h-4" />,
      children: (
        <TabPanel>
          <div className="text-center py-10 text-neutral-500">
            <UserCog className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Gestión de usuarios y roles</h3>
            <p className="text-sm">Administrá usuarios, permisos y roles del sistema</p>
            <Button className="mt-4" variant="outline">
              Ver administración de usuarios
            </Button>
          </div>
        </TabPanel>
      ),
    },
    {
      value: "seguridad",
      label: "Seguridad",
      icon: <Shield className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Autenticación" icon={<Shield className="w-4 h-4 text-gold-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <FilaSwitch
                id="dosFactores"
                titulo="Autenticación de dos factores (2FA)"
                descripcion="Requerir 2FA para todos los usuarios"
              />
              <FilaSwitch
                id="bloqueoIntentos"
                titulo="Bloqueo por intentos fallidos"
                descripcion="Bloquear cuenta tras 5 intentos fallidos"
                defaultChecked
              />
              <FilaSwitch
                id="expiracionSesion"
                titulo="Expiración de sesión"
                descripcion="Cerrar sesión tras 30 min de inactividad"
                defaultChecked
              />
              <FilaSwitch
                id="historialPass"
                titulo="Historial de contraseñas"
                descripcion="Impedir reutilizar las últimas 5 contraseñas"
                defaultChecked
              />
            </div>
          </Seccion>

          <Seccion titulo="Políticas de contraseña" icon={<Key className="w-4 h-4 text-gold-600" />} bordeSuperior>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Campo label="Longitud mínima" htmlFor="minLongitud">
                <Input id="minLongitud" type="number" defaultValue="8" min="6" max="32" />
              </Campo>
              <Campo label="Expiración (días)" htmlFor="maxEdad">
                <Input id="maxEdad" type="number" defaultValue="90" min="30" max="365" />
              </Campo>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[
                { id: "reqMayus", label: "Mayúsculas" },
                { id: "reqMinus", label: "Minúsculas" },
                { id: "reqNum", label: "Números" },
                { id: "reqSimb", label: "Símbolos" },
              ].map((req) => (
                <div key={req.id} className="flex items-center gap-2">
                  <input type="checkbox" id={req.id} defaultChecked className={checkboxClass} />
                  <Label htmlFor={req.id} className="text-sm">
                    {req.label}
                  </Label>
                </div>
              ))}
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
    {
      value: "notificaciones",
      label: "Notificaciones",
      icon: <Bell className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Canales de notificación" icon={<Bell className="w-4 h-4 text-gold-600" />}>
            <div className="space-y-2">
              {canalesNotificacion.map((canal) => {
                const activo = canalesActivosPorDefecto.includes(canal);
                const id = `canal-${canal.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                return (
                  <div key={canal} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={id} defaultChecked={activo} className={checkboxClass} />
                      <Label htmlFor={id} className="font-medium text-neutral-900 text-sm">
                        {canal}
                      </Label>
                    </div>
                    <Badge variant={activo ? "success" : "default"} className="text-xs">
                      {activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Seccion>

          <Seccion titulo="Eventos a notificar" icon={<Bell className="w-4 h-4 text-gold-600" />} bordeSuperior>
            <div className="space-y-2">
              {eventosNotificacion.map((evento) => {
                const id = `evento-${evento.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                return (
                  <div key={evento} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                    <Label htmlFor={id} className="text-neutral-700 text-sm font-normal">
                      {evento}
                    </Label>
                    <input type="checkbox" id={id} defaultChecked className={checkboxClass} />
                  </div>
                );
              })}
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
    {
      value: "apariencia",
      label: "Apariencia",
      icon: <Palette className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Tema" icon={<Palette className="w-4 h-4 text-gold-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {temas.map((t) => (
                <label
                  key={t.value}
                  htmlFor={`tema-${t.value}`}
                  className={`flex items-center justify-between p-3 rounded cursor-pointer border transition-colors ${
                    tema === t.value
                      ? "bg-gold-50 border-gold-400"
                      : "bg-neutral-50 border-transparent hover:border-neutral-200"
                  }`}
                >
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">{t.label}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{t.desc}</p>
                  </div>
                  <input
                    type="radio"
                    id={`tema-${t.value}`}
                    name="tema"
                    checked={tema === t.value}
                    onChange={() => setTema(t.value)}
                    className="text-gold-600 focus:ring-gold-400"
                  />
                </label>
              ))}
            </div>
          </Seccion>

          <Seccion titulo="Color de acento" icon={<Palette className="w-4 h-4 text-gold-600" />} bordeSuperior>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de acento">
              {coloresAcento.map((c) => {
                const seleccionado = acento === c.valor;
                return (
                  <button
                    key={c.valor}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    aria-label={c.nombre}
                    title={c.nombre}
                    onClick={() => setAcento(c.valor)}
                    className={`w-9 h-9 rounded-md border-2 flex items-center justify-center transition-all ${
                      seleccionado
                        ? "border-neutral-900 scale-110"
                        : "border-transparent hover:border-neutral-300"
                    }`}
                    style={{ backgroundColor: c.valor }}
                  >
                    {seleccionado && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
    {
      value: "sistema",
      label: "Sistema",
      icon: <Database className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Base de datos" icon={<Database className="w-4 h-4 text-gold-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Campo label="Host" htmlFor="dbHost">
                <Input id="dbHost" defaultValue="localhost" disabled />
              </Campo>
              <Campo label="Puerto" htmlFor="dbPuerto">
                <Input id="dbPuerto" type="number" defaultValue="5432" disabled />
              </Campo>
              <Campo label="Base de datos" htmlFor="dbNombre">
                <Input id="dbNombre" defaultValue="sistema_hotelero_db" disabled />
              </Campo>
              <Campo label="Usuario" htmlFor="dbUsuario">
                <Input id="dbUsuario" defaultValue="postgres" disabled />
              </Campo>
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" leftIcon={<Database className="w-3.5 h-3.5" />}>
                Probar conexión
              </Button>
              <Button variant="outline" size="sm" leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}>
                Ejecutar migraciones
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
                Backup manual
              </Button>
            </div>
          </Seccion>

          <Seccion titulo="Mantenimiento" icon={<Settings className="w-4 h-4 text-gold-600" />} bordeSuperior>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FilaSwitch
                tarjeta
                id="limpiezaLogs"
                titulo="Limpieza automática de logs"
                descripcion="Eliminar logs mayores a 90 días"
              />
              <FilaSwitch
                tarjeta
                id="compresionBackups"
                titulo="Compresión de backups"
                descripcion="Comprimir backups automáticos"
              />
              <FilaSwitch
                tarjeta
                id="modoMantenimiento"
                titulo="Modo mantenimiento"
                descripcion="Deshabilitar acceso a usuarios no admin"
              />
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
    {
      value: "integraciones",
      label: "Integraciones",
      icon: <Globe className="w-4 h-4" />,
      children: (
        <TabPanel>
          <Seccion titulo="Integraciones externas" icon={<Globe className="w-4 h-4 text-gold-600" />}>
            <div className="space-y-2">
              {integraciones.map((integracion) => (
                <div
                  key={integracion.nombre}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden="true">
                      {integracion.icon}
                    </span>
                    <span className="font-medium text-neutral-900 text-sm">{integracion.nombre}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={varianteEstado[integracion.estado]} className="text-xs">
                      {etiquetaEstado[integracion.estado]}
                    </Badge>
                    <Button variant="ghost" size="sm" className="px-2 py-1">
                      Configurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        </TabPanel>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Configuración"
        descripcion="Ajustes globales del sistema"
        acciones={
          <div className="flex items-center gap-3">
            {guardado && (
              <span role="status" className="flex items-center gap-1.5 text-sm text-green-700">
                <Check className="w-4 h-4" />
                Cambios guardados
              </span>
            )}
            <Button
              onClick={handleGuardar}
              disabled={guardando}
              size="sm"
              leftIcon={
                guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />
              }
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        }
      />

      <Card padding="none" className="overflow-hidden">
        <Tabs
          tabs={tabsConfiguracion}
          activeTab={tabActivo}
          onChange={setTabActivo}
          variant="default"
          fullWidth
        />
      </Card>
    </>
  );
}