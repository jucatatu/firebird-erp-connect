import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ErpResponse } from "./erp-orders.functions";

export interface ErpSeller {
  id: number;
  name: string;
  nickname: string | null;
  companyId: 1 | 3;
}

export const searchErpSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => 
    z.object({
      q: z.string().optional().default(""),
      companyId: z.union([z.literal(1), z.literal(3)]).optional(),
      limit: z.number().optional().default(50)
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const query: Record<string, string> = {};
    if (data.q) query.q = data.q;
    if (data.companyId) query.companyId = String(data.companyId);
    if (data.limit) query.limit = String(data.limit);

    return callErp({
      method: "GET",
      path: "/api/v1/sellers",
      query
    }) as Promise<ErpResponse<{ sellers: ErpSeller[] }>>;
  });

export const getErpSellerDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: sellerId }) => {
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: `/api/v1/sellers/${sellerId}`
    }) as Promise<ErpResponse<{ seller: ErpSeller }>>;
  });

/**
 * Helper server-side para validar um vendedor ERP e sua compatibilidade com empresas.
 */
export async function validateErpSellerForCompanies(
  erpSellerId: number | null,
  companies: number[]
) {
  if (erpSellerId === null) return { ok: true };

  // Validação básica do ID
  if (erpSellerId <= 0 || !Number.isInteger(erpSellerId)) {
    return { 
      ok: false, 
      error: { code: "INVALID_SELLER_ID", message: "ID de vendedor inválido." } 
    };
  }

  const result = await getErpSellerDetail({ data: erpSellerId });

  if (!result.ok) {
    // Preservar códigos de erro específicos do ERP
    const code = result.error?.code || "ERP_UNAVAILABLE";
    const message = (code === "SELLER_NOT_FOUND" || result.status === 404)
      ? "O vendedor selecionado não existe mais no ERP."
      : "Não foi possível consultar os vendedores no ERP neste momento. Tente novamente.";
    
    return { ok: false, error: { code, message } };
  }

  const seller = result.data?.seller;
  if (!seller) {
    return { 
      ok: false, 
      error: { code: "SELLER_NOT_FOUND", message: "O vendedor selecionado não existe mais no ERP." } 
    };
  }

  if (!companies.includes(seller.companyId)) {
    return { 
      ok: false, 
      error: { 
        code: "SELLER_COMPANY_MISMATCH", 
        message: "O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário." 
      } 
    };
  }

  return { ok: true, seller };
}
