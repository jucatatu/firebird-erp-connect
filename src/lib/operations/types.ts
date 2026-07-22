export type OperationalStatus =
  | "pending"
  | "in_progress"
  | "delivered"
  | "collected"
  | "customer_will_call"
  | "not_found"
  | "rescheduled"
  | "awaiting_pickup_definition"
  | "awaiting_customer_contact"
  | "pickup_scheduled"
  | "pickup_in_progress"
  | "pickup_completed";

export type OperationEventType =
  | "loaded"
  | "started"
  | "note_added"
  | "rescheduled"
  | "customer_will_call"
  | "delivered"
  | "collected"
  | "not_found"
  | "corrected"
  | "delivery_assigned"
  | "delivery_assignee_changed"
  | "delivery_started"
  | "delivery_confirmed"
  | "delivery_customer_not_found"
  | "delivery_rescheduled"
  | "customer_will_contact"
  | "pickup_scheduled"
  | "pickup_rescheduled"
  | "pickup_assigned"
  | "pickup_assignee_changed"
  | "pickup_started"
  | "pickup_customer_not_found"
  | "pickup_confirmed"
  | "operation_completed";

export type OperationEventOrigin = "local" | "erp";

export interface OperationState {
  id: string;
  erp_order_id: number;
  erp_order_number: number | null;
  company_id: number | null;
  operation_date: string;
  operational_date: string | null;
  operational_status: OperationalStatus;
  sequence: number | null;
  reschedule_reason: string | null;
  snapshot: Record<string, unknown>;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  /** Optimistic-concurrency version. Incremented on every RPC update. */
  version: number;
  has_returnable_equipment?: boolean;
  delivery_assignee_id?: string | null;
  delivery_assigned_at?: string | null;
  delivery_assigned_by?: string | null;
  pickup_assignee_id?: string | null;
  pickup_assigned_at?: string | null;
  pickup_assigned_by?: string | null;
  pickup_scheduled_date?: string | null;
  pickup_scheduled_time?: string | null;
  pickup_note?: string | null;
}

/**
 * Snapshot fields explicitly persisted on operation_states.snapshot.
 * Kept minimal: only fields needed to keep the row usable if the ERP
 * later renames/removes the underlying record. No credentials, no
 * financial data, no ERP items/equipment (those are re-fetched live).
 */
export const SNAPSHOT_FIELDS = [
  "customerName",
  "address",
  "phone",
  "orderNumber",
  "deliveryDate",
  "period",
] as const;
export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

/** Error code raised by RPCs when optimistic-lock version mismatch. */
export const OPERATION_CONFLICT_CODE = "P0004";
export class OperationConflictError extends Error {
  constructor(message = "Este pedido foi alterado por outro usuário.") {
    super(message);
    this.name = "OperationConflictError";
  }
}

export interface OperationEvent {
  id: string;
  operation_state_id: string;
  event_type: OperationEventType;
  description: string | null;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  origin: OperationEventOrigin;
  created_at: string;
}

export interface OperationNote {
  id: string;
  operation_state_id: string;
  body: string;
  author_id: string;
  created_at: string;
}

export interface OrderSnapshotInput {
  erpOrderId: number;
  erpOrderNumber?: number | null;
  companyId?: number | null;
  operationDate: string;
  customerName?: string | null;
  address?: string | null;
  phone?: string | null;
  snapshot?: Record<string, unknown>;
  hasReturnableEquipment?: boolean;
}

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  pending: "Pendente",
  in_progress: "Em atendimento",
  delivered: "Entregue",
  collected: "Recolhido",
  customer_will_call: "Cliente irá avisar",
  not_found: "Não localizado",
  rescheduled: "Reagendado",
  awaiting_pickup_definition: "Aguardando definição do recolhimento",
  awaiting_customer_contact: "Aguardando cliente avisar",
  pickup_scheduled: "Recolhimento agendado",
  pickup_in_progress: "Em recolhimento",
  pickup_completed: "Recolhimento concluído",
};

// Cores usadas no marcador do mapa (hex). Mantidas independentes do
// geocoding (que continua com badges próprios).
export const OPERATIONAL_STATUS_COLOR: Record<OperationalStatus, string> = {
  pending: "#ea6a2a",         // laranja (default map-pedido)
  in_progress: "#2563eb",     // azul
  delivered: "#16a34a",       // verde
  collected: "#7c3aed",       // roxo
  customer_will_call: "#eab308", // amarelo
  not_found: "#6b7280",       // cinza
  rescheduled: "#0ea5e9",     // ciano
  awaiting_pickup_definition: "#f59e0b", // âmbar
  awaiting_customer_contact: "#eab308",  // amarelo
  pickup_scheduled: "#0ea5e9",           // ciano
  pickup_in_progress: "#7c3aed",         // roxo
  pickup_completed: "#16a34a",           // verde
};