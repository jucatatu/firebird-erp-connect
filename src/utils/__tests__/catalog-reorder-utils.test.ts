import { describe, it, expect } from "vitest";
import { moveItem, hasOrderChanged, flattenProductGroups, calculateNextSortOrder } from "../catalog-reorder-utils";
import { CatalogSetting } from "../../lib/catalog/types";

describe("catalog-reorder-utils", () => {
  describe("moveItem", () => {
    it("should move an item to the beginning", () => {
      const list = ["A", "B", "C"];
      expect(moveItem(list, 2, 0)).toEqual(["C", "A", "B"]);
    });

    it("should move an item to the end", () => {
      const list = ["A", "B", "C"];
      expect(moveItem(list, 0, 2)).toEqual(["B", "C", "A"]);
    });
  });

  describe("hasOrderChanged", () => {
    it("should return false if order is the same", () => {
      expect(hasOrderChanged(["1", "2"], ["1", "2"])).toBe(false);
    });

    it("should return true if order changed", () => {
      expect(hasOrderChanged(["1", "2"], ["2", "1"])).toBe(true);
    });
  });

  describe("flattenProductGroups", () => {
    it("should concatenate groups in correct order", () => {
      const groups = {
        chopp: [{ id: "A" } as any],
        growler: [{ id: "B" } as any],
        garrafas: [{ id: "C" } as any],
        outros: [{ id: "D" } as any],
      };
      const result = flattenProductGroups(groups);
      expect(result.map(r => r.id)).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("calculateNextSortOrder", () => {
    it("should return 10 for empty list", () => {
      expect(calculateNextSortOrder([])).toBe(10);
    });

    it("should return max + 10", () => {
      const settings = [
        { sort_order: 10 },
        { sort_order: 30 },
        { sort_order: 20 },
      ] as CatalogSetting[];
      expect(calculateNextSortOrder(settings)).toBe(40);
    });
  });
});
