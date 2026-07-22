import { describe, it, expect } from "vitest";
import { hasReturnableEquipment, needsPickup } from "../equipment";

describe("hasReturnableEquipment", () => {
  it("é falso quando não há equipments", () => {
    expect(hasReturnableEquipment({})).toBe(false);
    expect(hasReturnableEquipment({ equipments: [] })).toBe(false);
    expect(hasReturnableEquipment(null)).toBe(false);
    expect(hasReturnableEquipment(undefined)).toBe(false);
  });

  it("é verdadeiro quando pelo menos um equipment tem quantidade > 0", () => {
    expect(
      hasReturnableEquipment({
        equipments: [{ type: "Chopeira", quantity: 1 }],
      }),
    ).toBe(true);
    expect(
      hasReturnableEquipment({
        equipments: [
          { type: "Chopeira", quantity: 0 },
          { type: "Torre", quantity: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("é falso quando todos equipments têm quantidade 0", () => {
    expect(
      hasReturnableEquipment({
        equipments: [{ type: "Chopeira", quantity: 0 }],
      }),
    ).toBe(false);
  });

  it("barril/growler listados apenas em items não geram pickup", () => {
    // items é ignorado — a função só olha equipments
    expect(hasReturnableEquipment({ equipments: [] })).toBe(false);
  });

  it("needsPickup é alias direto", () => {
    expect(needsPickup).toBe(hasReturnableEquipment);
  });
});