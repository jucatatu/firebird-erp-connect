export type OperationalStatus =
  | "pending"
  | "in_progress"
  | "delivered"
  | "collected"
  | "customer_will_call"
  | "not_found"
  | "rescheduled";

export type OperationEventType =
  | "loaded"
  | "started"
  | "note_added"
  | "rescheduled"
  | "customer_will_call"
  | "delivered"
  | "collected"
  | "not_found"
  | "corrected";

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
}

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  pending: "Pendente",
  in_progress: "Em atendimento",
  delivered: "Entregue",
  collected: "Recolhido",
  customer_will_call: "Cliente irá avisar",
  not_found: "Não localizado",
  rescheduled: "Reagendado",
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
};