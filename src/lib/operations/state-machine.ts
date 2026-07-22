import type { OperationalStatus } from "./types";

/**
 * Ações operacionais suportadas pela RPC `apply_operation_transition`
 * (a máquina de estados vive no banco; este módulo é o espelho da UI).
 */
export type OperationAction =
  | "start_delivery"
  | "confirm_delivery"
  | "delivery_not_found"
  | "reschedule_delivery"
  | "customer_will_contact"
  | "schedule_pickup"
  | "start_pickup"
  | "confirm_pickup"
  | "pickup_not_found";

export interface AllowedContext {
  status: OperationalStatus;
  hasReturnableEquipment: boolean;
}

export function getAllowedOperationalActions(ctx: AllowedContext): OperationAction[] {
  const { status } = ctx;
  switch (status) {
    case "pending":
    case "rescheduled":
      return ["start_delivery", "delivery_not_found", "reschedule_delivery"];
    case "in_progress":
      return ["confirm_delivery", "delivery_not_found", "reschedule_delivery"];
    case "not_found":
      return ["start_delivery", "reschedule_delivery"];
    case "awaiting_pickup_definition":
      return ["schedule_pickup", "customer_will_contact"];
    case "awaiting_customer_contact":
      return ["schedule_pickup"];
    case "pickup_scheduled":
      return ["start_pickup", "schedule_pickup", "pickup_not_found"];
    case "pickup_in_progress":
      return ["confirm_pickup", "pickup_not_found", "schedule_pickup"];
    case "delivered":
    case "pickup_completed":
    case "collected":
    case "customer_will_call":
      return [];
    default:
      return [];
  }
}

export function isOperationActive(status: OperationalStatus): boolean {
  return !(
    status === "delivered" ||
    status === "pickup_completed" ||
    status === "collected"
  );
}

/** Contexto atual: entrega ou recolhimento. */
export function operationContext(status: OperationalStatus): "delivery" | "pickup" {
  if (
    status === "awaiting_pickup_definition" ||
    status === "awaiting_customer_contact" ||
    status === "pickup_scheduled" ||
    status === "pickup_in_progress" ||
    status === "pickup_completed"
  ) {
    return "pickup";
  }
  return "delivery";
}

export const ACTION_LABEL: Record<OperationAction, string> = {
  start_delivery: "Iniciar entrega",
  confirm_delivery: "Confirmar entrega",
  delivery_not_found: "Cliente não localizado",
  reschedule_delivery: "Reagendar entrega",
  customer_will_contact: "Cliente avisará",
  schedule_pickup: "Agendar recolhimento",
  start_pickup: "Iniciar recolhimento",
  confirm_pickup: "Confirmar recolhimento",
  pickup_not_found: "Cliente não localizado",
};