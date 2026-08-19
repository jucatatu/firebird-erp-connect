import { describe, it, expect } from "vitest";
import { classifyOrderProduct } from "../order-product-group";

describe("classifyOrderProduct", () => {
  it("should classify standard CHOPP products", () => {
    expect(classifyOrderProduct({ description: "CHOPP PILSEN" })).toBe("CHOPP");
    expect(classifyOrderProduct({ description: "CHOPP AMERICAN IPA" })).toBe("CHOPP");
    expect(classifyOrderProduct({ description: "CHOPE WEIZEN" })).toBe("CHOPP");
  });

  it("should classify GROWLER products with priority", () => {
    expect(classifyOrderProduct({ description: "GROWLER PET 1,5L" })).toBe("GROWLER");
    // Priority test: CHOPP + GROWLER = GROWLER
    expect(classifyOrderProduct({ description: "CHOPP DE VINHO GROWLER PET 1,5L" })).toBe("GROWLER");
  });

  it("should classify GARRAFA products with priority over CHOPP", () => {
    expect(classifyOrderProduct({ description: "GARRAFA PILSEN 600ML" })).toBe("GARRAFA");
    // Priority test: CHOPP + GARRAFA = GARRAFA
    expect(classifyOrderProduct({ description: "CHOPP PILSEN EM GARRAFA" })).toBe("GARRAFA");
  });

  it("should use group description if available", () => {
    expect(classifyOrderProduct({ 
      description: "PILSEN", 
      group: { description: "CHOPP" } 
    })).toBe("CHOPP");
  });

  it("should fallback to OUTROS for unknown products", () => {
    expect(classifyOrderProduct({ description: "BONÉ LOGO" })).toBe("OUTROS");
    expect(classifyOrderProduct({ description: "" })).toBe("OUTROS");
  });

  it("should handle accents and case normalization", () => {
    expect(classifyOrderProduct({ description: "chopp pilsen" })).toBe("CHOPP");
    expect(classifyOrderProduct({ description: "Grôwler" })).toBe("GROWLER");
    expect(classifyOrderProduct({ description: "Garráfa" })).toBe("GARRAFA");
  });
});
