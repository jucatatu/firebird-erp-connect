import { describe, it, expect, vi } from "vitest";
import { searchErpProducts } from "../lib/erp.functions";

// Mocks para simular erp.server e supabaseAdmin
vi.mock("../lib/erp.server", () => ({
  callErp: vi.fn(async ({ path }) => {
    if (path === "/api/v1/products/1") {
      return { ok: true, data: { id: 1, description: "ERP PILSEN", code: "P1" }, status: 200 };
    }
    if (path === "/api/v1/products/102") {
      return { ok: true, data: { id: 102, description: "ERP IPA", code: "P102" }, status: 200 };
    }
    return { ok: false, status: 404 };
  })
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            contains: vi.fn(async () => ({
              data: [
                { erp_item_id: 1, display_name: "CHOPP PILSEN", sort_order: 10 },
                { erp_item_id: 102, display_name: "CHOPP IPA", sort_order: 5 }
              ],
              error: null
            }))
          })
        })
      })
    })
  }
}));

describe("Sprint 8.5.11 - Carga de Produtos por ID e Ordenação", () => {
  it("deve carregar produtos habilitados por ID e aplicar ordenação correta", async () => {
    const result = await (searchErpProducts as any)({
      data: { q: "", companyId: 1, isAdminSearch: false }
    });

    expect(result.ok).toBe(true);
    const products = result.data.products;
    expect(products).toHaveLength(2);

    // Ordem deve ser IPA (sort_order 5) depois PILSEN (sort_order 10)
    expect(products[0].id).toBe(102);
    expect(products[0].description).toBe("CHOPP IPA");
    expect(products[0].order).toBe(5);

    expect(products[1].id).toBe(1);
    expect(products[1].description).toBe("CHOPP PILSEN");
    expect(products[1].order).toBe(10);
  });
});
