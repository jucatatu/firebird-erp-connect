import { describe, it, expect } from "vitest";
import {
  hasPickupRequiredEquipment,
  hasReturnableEquipment,
  isPickupRequiredType,
  needsPickup,
} from "../equipment";

describe("hasPickupRequiredEquipment", () => {
  it("é falso quando não há equipments", () => {
    expect(hasPickupRequiredEquipment({})).toBe(false);
    expect(hasPickupRequiredEquipment({ equipments: [] })).toBe(false);
    expect(hasPickupRequiredEquipment(null)).toBe(false);
    expect(hasPickupRequiredEquipment(undefined)).toBe(false);
  });

  it("chopeira (elétrica/gelo/comum) abre recolha", () => {
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Chopeira", quantity: 1 }] })).toBe(true);
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "CHOPEIRA ELETRICA", quantity: 1 }] })).toBe(true);
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Chopeira Gelo", quantity: 1 }] })).toBe(true);
  });

  it("cilindro de CO2 abre recolha", () => {
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Cilindro CO2", quantity: 1 }] })).toBe(true);
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "CO2", quantity: 1 }] })).toBe(true);
  });

  it("barril NÃO abre recolha", () => {
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "BARRIL 30L", quantity: 1 }] })).toBe(false);
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Barril 50L", quantity: 2 }] })).toBe(false);
  });

  it("growler NÃO abre recolha", () => {
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Growler", quantity: 1 }] })).toBe(false);
  });

  it("mistura: barril + chopeira → abre recolha", () => {
    expect(
      hasPickupRequiredEquipment({
        equipments: [
          { type: "BARRIL 30L", quantity: 1 },
          { type: "Chopeira", quantity: 1 },
        ],
      }),
    ).toBe(true);
  });

  it("chopeira com quantidade 0 não conta", () => {
    expect(hasPickupRequiredEquipment({ equipments: [{ type: "Chopeira", quantity: 0 }] })).toBe(false);
  });

  it("isPickupRequiredType classifica corretamente", () => {
    expect(isPickupRequiredType("Chopeira")).toBe(true);
    expect(isPickupRequiredType("Cilindro CO2")).toBe(true);
    expect(isPickupRequiredType("BARRIL 30L")).toBe(false);
    expect(isPickupRequiredType("Growler")).toBe(false);
    expect(isPickupRequiredType(null)).toBe(false);
  });

  it("aliases hasReturnableEquipment e needsPickup apontam para a mesma função", () => {
    expect(hasReturnableEquipment).toBe(hasPickupRequiredEquipment);
    expect(needsPickup).toBe(hasPickupRequiredEquipment);
  });
});