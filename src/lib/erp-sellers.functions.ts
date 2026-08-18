import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
// Tipo local neutro para remover dependência de Pedidos
export interface ErpResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: any;
  } | null;
}

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
    const { getErpSellerDetailServer } = await import("./erp-sellers.server");
    return getErpSellerDetailServer(sellerId);
  });

/**
 * Helper server-side para validar um vendedor ERP e sua compatibilidade com empresas.
 */
export async function validateErpSellerForCompanies(
  erpSellerId: number | null,
  companies: number[]
) {
  const { validateErpSellerForCompaniesServer } = await import("./erp-sellers.server");
  return validateErpSellerForCompaniesServer(erpSellerId, companies);
}
