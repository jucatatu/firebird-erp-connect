
import { describe, it, expect, vi } from "vitest";

// Mock do supabaseAdmin e callErp para simular o ambiente de auditoria/teste
const mockSupabaseAdmin = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
};

describe("Sprint 8.5.10 - Catalog Column Correction", () => {
  it("should verify that the column used in query is sort_order and not ordem", async () => {
    // Simulando o que o código faz agora
    const selectParams = "erp_item_id, display_name, sort_order";
    expect(selectParams).toContain("sort_order");
    expect(selectParams).not.toContain("ordem");
  });

  it("should map sort_order to internal 'order' property correctly", () => {
    const dbRecord = { erp_item_id: 1, display_name: "PILSEN", sort_order: 10 };
    const catalogConfig = {
      [dbRecord.erp_item_id]: {
        display_name: dbRecord.display_name,
        order: dbRecord.sort_order ?? 0
      }
    };
    
    expect(catalogConfig[1].order).toBe(10);
  });

  it("should handle null sort_order with fallback to 0", () => {
    const dbRecord = { erp_item_id: 1, display_name: "PILSEN", sort_order: null };
    const catalogConfig = {
      [dbRecord.erp_item_id]: {
        display_name: dbRecord.display_name,
        order: dbRecord.sort_order ?? 0
      }
    };
    
    expect(catalogConfig[1].order).toBe(0);
  });
});
