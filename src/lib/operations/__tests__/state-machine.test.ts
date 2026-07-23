import { describe, it, expect } from "vitest";
import {
  getAllowedOperationalActions,
  canTransition,
  operationContext,
  isOperationActive,
} from "../state-machine";

describe("state-machine allowed actions", () => {
  it("pending expõe confirm_delivery direto (sem Iniciar entrega)", () => {
    const acts = getAllowedOperationalActions({
      status: "pending",
      hasReturnableEquipment: false,
    });
    expect(acts).toEqual(["confirm_delivery", "delivery_not_found", "reschedule_delivery"]);
    expect(acts).not.toContain("start_delivery");
  });

  it("start_delivery nunca aparece em nenhum estado (é interno)", () => {
    const statuses = [
      "pending","in_progress","rescheduled","not_found",
      "awaiting_pickup_definition","awaiting_customer_contact",
      "pickup_scheduled","pickup_in_progress",
      "delivered","pickup_completed","collected","customer_will_call",
    ] as const;
    for (const s of statuses) {
      const acts = getAllowedOperationalActions({ status: s, hasReturnableEquipment: true });
      expect(acts).not.toContain("start_delivery");
    }
  });

  it("in_progress permite confirm_delivery, delivery_not_found, reschedule_delivery", () => {
    expect(canTransition("in_progress", "confirm_delivery")).toBe(true);
    expect(canTransition("in_progress", "reschedule_delivery")).toBe(true);
  });

  it("awaiting_pickup_definition permite schedule_pickup e customer_will_contact", () => {
    const acts = getAllowedOperationalActions({
      status: "awaiting_pickup_definition",
      hasReturnableEquipment: true,
    });
    expect(acts).toContain("schedule_pickup");
    expect(acts).toContain("customer_will_contact");
  });

  it("awaiting_customer_contact permite apenas schedule_pickup", () => {
    expect(canTransition("awaiting_customer_contact", "schedule_pickup")).toBe(true);
    expect(canTransition("awaiting_customer_contact", "start_pickup")).toBe(false);
  });

  it("pickup_scheduled permite start_pickup / reagendar / não localizado", () => {
    expect(canTransition("pickup_scheduled", "start_pickup")).toBe(true);
    expect(canTransition("pickup_scheduled", "pickup_not_found")).toBe(true);
    expect(canTransition("pickup_scheduled", "confirm_pickup")).toBe(false);
  });

  it("pickup_in_progress permite confirm_pickup", () => {
    expect(canTransition("pickup_in_progress", "confirm_pickup")).toBe(true);
  });

  it("delivered não permite mais nenhuma ação", () => {
    expect(
      getAllowedOperationalActions({
        status: "delivered",
        hasReturnableEquipment: false,
      }),
    ).toEqual([]);
  });

  it("pickup_completed não permite mais nenhuma ação", () => {
    expect(
      getAllowedOperationalActions({
        status: "pickup_completed",
        hasReturnableEquipment: true,
      }),
    ).toEqual([]);
  });

  it("operationContext distingue entrega vs recolhimento", () => {
    expect(operationContext("pending")).toBe("delivery");
    expect(operationContext("in_progress")).toBe("delivery");
    expect(operationContext("awaiting_pickup_definition")).toBe("pickup");
    expect(operationContext("pickup_scheduled")).toBe("pickup");
    expect(operationContext("pickup_in_progress")).toBe("pickup");
  });

  it("isOperationActive é falso para terminais", () => {
    expect(isOperationActive("delivered")).toBe(false);
    expect(isOperationActive("pickup_completed")).toBe(false);
    expect(isOperationActive("collected")).toBe(false);
    expect(isOperationActive("pending")).toBe(true);
    expect(isOperationActive("awaiting_pickup_definition")).toBe(true);
  });

  it("Recolher (confirm_pickup) NÃO aparece antes da entrega", () => {
    // Cenário: pedido pendente com equipamento retornável — a UI não deve
    // oferecer confirmar recolhimento antes do fluxo de entrega.
    const acts = getAllowedOperationalActions({
      status: "pending",
      hasReturnableEquipment: true,
    });
    expect(acts).not.toContain("confirm_pickup");
    expect(acts).not.toContain("start_pickup");
    expect(acts).not.toContain("schedule_pickup");
  });
});