import { describe, it, expect } from "vitest";
import {
  toPublicStatus,
  publicStatusLabel,
  publicStatusColor,
  pickupPeriodLabel,
  pickupPeriodAbbrev,
  isPickupPeriod,
} from "../types";
import { filterOfStatus } from "@/components/operation/operational-filters";

describe("toPublicStatus — mapeamento oficial de buckets públicos", () => {
  it("awaiting_pickup_definition NÃO é mapeado como Cliente irá avisar", () => {
    expect(toPublicStatus("awaiting_pickup_definition")).toBe("awaiting_definition");
    expect(toPublicStatus("awaiting_pickup_definition")).not.toBe("customer_will_call");
    expect(publicStatusLabel("awaiting_pickup_definition")).toBe("Definir recolha");
  });

  it("delivered → Concluído (não é mais bucket final visível)", () => {
    expect(toPublicStatus("delivered")).toBe("completed");
    expect(publicStatusLabel("delivered")).toBe("Concluído");
  });

  it("pickup_scheduled e pickup_in_progress → Recolha agendada", () => {
    expect(toPublicStatus("pickup_scheduled")).toBe("pickup_scheduled");
    expect(toPublicStatus("pickup_in_progress")).toBe("pickup_scheduled");
    expect(publicStatusColor("pickup_scheduled")).toBe("#16a34a");
  });

  it("customer_will_call e awaiting_customer_contact → Cliente irá avisar (âmbar)", () => {
    expect(toPublicStatus("customer_will_call")).toBe("customer_will_call");
    expect(toPublicStatus("awaiting_customer_contact")).toBe("customer_will_call");
    expect(publicStatusColor("customer_will_call")).toBe("#f59e0b");
  });

  it("pending e in_progress → Pendente (ouro)", () => {
    expect(toPublicStatus("pending")).toBe("pending");
    expect(toPublicStatus("in_progress")).toBe("pending");
    expect(publicStatusColor("pending")).toBe("#d99a22");
  });

  it("collected e pickup_completed → Concluído", () => {
    expect(toPublicStatus("collected")).toBe("completed");
    expect(toPublicStatus("pickup_completed")).toBe("completed");
  });
});

describe("pickupPeriod helpers", () => {
  it("isPickupPeriod aceita tokens estruturados", () => {
    expect(isPickupPeriod("manha")).toBe(true);
    expect(isPickupPeriod("tarde")).toBe(true);
    expect(isPickupPeriod("dia_todo")).toBe(true);
    expect(isPickupPeriod("00:00")).toBe(false);
    expect(isPickupPeriod("")).toBe(false);
    expect(isPickupPeriod(null)).toBe(false);
  });

  it("pickupPeriodLabel converte tokens em português", () => {
    expect(pickupPeriodLabel("manha")).toBe("Manhã");
    expect(pickupPeriodLabel("tarde")).toBe("Tarde");
    expect(pickupPeriodLabel("dia_todo")).toBe("Dia todo");
  });

  it("pickupPeriodLabel ignora 00:00 e string vazia", () => {
    expect(pickupPeriodLabel("00:00")).toBeNull();
    expect(pickupPeriodLabel("")).toBeNull();
    expect(pickupPeriodLabel(null)).toBeNull();
  });

  it("pickupPeriodLabel preserva HH:mm legado", () => {
    expect(pickupPeriodLabel("14:30")).toBe("14:30");
  });

  it("pickupPeriodAbbrev retorna abreviações do marcador", () => {
    expect(pickupPeriodAbbrev("manha")).toBe("MANHÃ");
    expect(pickupPeriodAbbrev("tarde")).toBe("TARDE");
    expect(pickupPeriodAbbrev("dia_todo")).toBe("DIA TODO");
    expect(pickupPeriodAbbrev("00:00")).toBeNull();
  });
});

describe("filterOfStatus — buckets simplificados", () => {
  it("entregas: pending, in_progress, rescheduled, not_found", () => {
    expect(filterOfStatus("pending")).toBe("deliveries");
    expect(filterOfStatus("in_progress")).toBe("deliveries");
    expect(filterOfStatus("rescheduled")).toBe("deliveries");
    expect(filterOfStatus("not_found")).toBe("deliveries");
  });

  it("recolhas: awaiting_pickup_definition + estados de pickup", () => {
    expect(filterOfStatus("awaiting_pickup_definition")).toBe("pickups");
    expect(filterOfStatus("awaiting_customer_contact")).toBe("pickups");
    expect(filterOfStatus("pickup_scheduled")).toBe("pickups");
    expect(filterOfStatus("pickup_in_progress")).toBe("pickups");
  });

  it("customer_will_call é bucket próprio", () => {
    expect(filterOfStatus("customer_will_call")).toBe("customer_will_call");
  });

  it("concluídos: delivered, collected, pickup_completed", () => {
    expect(filterOfStatus("delivered")).toBe("completed");
    expect(filterOfStatus("collected")).toBe("completed");
    expect(filterOfStatus("pickup_completed")).toBe("completed");
  });
});
