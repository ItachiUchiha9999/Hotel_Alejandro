/**
 * Tipos compartidos. Usan los mismos nombres de campo que la base y que la API,
 * para no tener que traducir en cada pantalla.
 */

export interface Deposito {
  deposit_id: number;
  deposit_name: string;
  deposit_location: string | null;
  deposit_state: boolean;
}

export interface Categoria {
  category_id: number;
  category_name: string;
  category_description: string | null;
  category_state: boolean;
}

export interface Articulo {
  article_id: number;
  category_id: number;
  category_name?: string | null;
  article_code: string;
  article_number: string | null;
  article_name: string;
  article_compound_name: string | null;
  article_description: string | null;
  article_unit_of_measure: string;
  article_stock_min_general: string | number;
  article_state: boolean;
}

export type Efecto = "SUMA" | "RESTA" | "TRANSFERENCIA";

export interface TipoMovimiento {
  movement_type_id: number;
  movement_type: string;
  description: string;
  effect: Efecto;
  active?: boolean;
}

export interface RenglonMovimiento {
  article_code: string;
  article_name: string;
  amount: number;
}

export interface FilaSaldo {
  stock_id: number;
  stock_amount: string | number;
  update_date: string;
  articles: {
    article_id: number;
    article_code: string;
    article_name: string;
    article_unit_of_measure: string;
    article_stock_min_general: string | number;
  };
  deposit: { deposit_id: number; deposit_name: string };
}

export interface DetalleMovimiento {
  detail_id: number;
  amount: string | number;
  articles_deposit_stock: {
    articles: { article_code: string; article_name: string };
    deposit: { deposit_name: string };
  } | null;
}

export interface Movimiento {
  stock_movement_id: number;
  transaction_date: string;
  observations: string | null;
  movement_type: { movement_type: string; effect: Efecto };
  employees: { employees_name: string; employees_lastname: string };
  deposit_origin: { deposit_id: number; deposit_name: string } | null;
  deposit_destination: { deposit_id: number; deposit_name: string } | null;
  movement_stock_detail: DetalleMovimiento[];
}

export interface TipoComprobante {
  voucher_type_id: number;
  voucher_type: string;
  description: string;
  sign: number;
  affects_account: boolean;
  is_payable: boolean;
  active: boolean;
}

export interface Proveedor {
  supplier_id: number;
  supplier_legal_name: string;
  supplier_trade_name: string | null;
  supplier_cuit: string;
  supplier_state: boolean;
}

export interface Comprobante {
  voucher_id: number;
  supplier_id: number;
  supplier_legal_name: string;
  supplier_trade_name: string | null;
  voucher_type: string;
  voucher_full_number: string;
  issue_date: string;
  due_date: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  pending_amount: string | number;
  voucher_status: "PENDIENTE" | "PAGADO" | "ANULADO";
  is_overdue: boolean;
}

/* ---------------------------------------------------------------------------
 * Sprint 3 — Habitaciones (HAB-03, HAB-01)
 * ------------------------------------------------------------------------- */

export type EstadoHabitacion =
  | "DISPONIBLE"
  | "OCUPADA"
  | "LIMPIEZA"
  | "MANTENIMIENTO"
  | "FUERA_DE_SERVICIO";

export interface TipoHabitacion {
  room_type_id: number;
  room_type_name: string;
  room_type_description: string | null;
  room_type_max_capacity: number;
  room_type_state: boolean;
  rooms_count: number;
  current_price?: string | number | null;
  current_currency?: string | null;
}

export interface Habitacion {
  room_id: number;
  room_number: string;
  room_type_id: number;
  room_state: EstadoHabitacion;
  room_type: {
    room_type_id: number;
    room_type_name: string;
    room_type_max_capacity: number;
    room_type_state: boolean;
  };
}

/* ---------------------------------------------------------------------------
 * Sprint 3 — Reservas (RES-01, RES-09, RES-11)
 * ------------------------------------------------------------------------- */

export type EstadoReserva =
  | "PENDIENTE"
  | "CONFIRMADA"
  | "IN_HOUSE"
  | "FINALIZADA"
  | "CANCELADA"
  | "NO_SHOW";

export interface HuespedResumen {
  guest_id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
}

export interface HabitacionResumen {
  room_id: number;
  room_number: string;
}

export interface Reserva {
  reservation_id: number;
  reservation_code: string;
  guest_id: number;
  room_id: number;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  price_per_night: string | number;
  reservation_status: EstadoReserva;
  reservation_source: string;
  observations: string | null;
  creation_date?: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  guest: HuespedResumen;
  room: HabitacionResumen;
}

export interface CheckInInfo {
  check_in_id: number;
  reservation_id: number;
  check_in_at: string;
  actual_adults: number | null;
  actual_children: number | null;
  observations: string | null;
  employees_id: number;
}

export interface CheckOutInfo {
  check_out_id: number;
  reservation_id: number;
  check_out_at: string;
  pending_charges: boolean;
  pending_detail: string | null;
  observations: string | null;
  employees_id: number;
}

export interface ReservaDetalle extends Reserva {
  check_in: CheckInInfo | null;
  check_out: CheckOutInfo | null;
}