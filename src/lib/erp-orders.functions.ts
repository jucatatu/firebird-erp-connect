import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];


// Reutilizamos tipos básicos para consistência
export interface ErpResponse<T = JsonValue> {
  ok: boolean;
  status: number;
  data: T | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: JsonValue;
  } | null;
}

// --- CLIENTS ---
export interface ErpClient {
  id: number;
  name: string;
  tradingName: string | null;
  document: string | null;
  code: string | null;
  companyId: number | null;
  active: boolean | null;
  address?: {
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
}

export interface ErpProduct {
  id: number;
  code: string | null;
  description: string;
  companyId: number | null;
  active: boolean | null;
  unit?: {
    code: string | null;
    description: string | null;
  } | null;
}

export interface ErpEquipmentType {
  id: number;
  code: string | null;
  description: string;
  active: boolean | null;
  category?: string | null;
  returnable?: boolean | null;
}

export const searchErpClients = createServerFn({ method: "GET" })
  .inputValidator((d) => 
    z.object({
      q: z.string().optional().default(""), // Sprint 8.5.8: Permitir string vazia para listagem inicial se necessário
      document: z.string().optional(),
      phone: z.string().optional(),
      companyId: z.union([z.literal(1), z.literal(3)]).optional(),
      limit: z.number().optional().default(20),
      cursor: z.number().optional()
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const query: Record<string, string> = {};
    if (data.q) query.q = data.q;
    if (data.document) query.document = data.document;
    if (data.phone) query.phone = data.phone;
    if (data.companyId) query.companyId = String(data.companyId);
    if (data.limit) query.limit = String(data.limit);
    if (data.cursor) query.cursor = String(data.cursor);

    return callErp({
      method: "GET",
      path: "/api/v1/clients",
      query
    }) as Promise<ErpResponse<{ clients: ErpClient[]; nextCursor: number | null }>>;
  });

// --- PRICING ---
export interface PriceResolution {
  productId: number;
  priceFound: boolean;
  unitPrice: number;
  strategy: string;
}

export const resolveErpPrice = createServerFn({ method: "GET" })
  .inputValidator((d) => 
    z.object({
      productId: z.number(),
      clientId: z.number()
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: "/api/v1/pricing/resolve",
      query: data as any
    }) as Promise<ErpResponse<PriceResolution>>;
  });

// --- ORDERS ---
export interface CreateOrderInput {
  companyId: number;
  clientId: number;
  sellerId: number;
  saleTypeId: number;
  paymentTermId: number;
  paymentMethodId: number;
  deliver: boolean;
  deliveryAt: string;
  returnEquipment: boolean;
  returnAt?: string | null;
  freightValue?: number;
  notes?: string | null;
  items: Array<{ 
    productId: number; 
    quantity: number;
    manualUnitPrice?: number; 
  }>;
  equipments: Array<{ equipmentTypeId: number; quantity: number }>;
}

export const createErpOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { data: CreateOrderInput; idempotencyKey?: string }) => d)
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return handleCreateErpOrder(data.data, data.idempotencyKey, supabaseAdmin);
  });

/**
 * Lógica interna testável sem dependência de AsyncLocalStorage do createServerFn.
 */
export async function handleCreateErpOrder(
  input: CreateOrderInput,
  idempotencyKey: string | undefined,
  supabaseAdmin: any
): Promise<ErpResponse<{ orderId: number; orderNumber: number; status: string }>> {
  const { callErp } = await import("./erp.server");

  // 1. Resolver o sellerId a partir do auth.uid()
  const { data: { user } } = await supabaseAdmin.auth.getUser();
  if (!user) {
    return {
      ok: false,
      status: 401,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Usuário não autenticado no servidor.", retryable: false }
    };
  }

  // 2. Auditoria Server-Side de Empresa (Sprint 8.2)
  // Buscamos as empresas permitidas ao usuário no banco
  const { data: userCompanies, error: ucaErr } = await supabaseAdmin
    .from("user_company_access")
    .select("company_id")
    .eq("user_id", user.id);

  if (ucaErr || !userCompanies || userCompanies.length === 0) {
    return {
      ok: false,
      status: 403,
      data: null,
      error: { code: "NO_COMPANY_ACCESS", message: "Usuário não possui acesso a nenhuma empresa.", retryable: false }
    };
  }

  const allowedCompanyIds = userCompanies.map((c: any) => c.company_id);
  const requestedCompanyId = input.companyId;

  // Validação estrita: O companyId deve ser 1 ou 3 E estar nas permissões do usuário
  if (![1, 3].includes(requestedCompanyId)) {
    return {
      ok: false,
      status: 400,
      data: null,
      error: { code: "INVALID_COMPANY", message: "ID de empresa inválido.", retryable: false }
    };
  }

  if (!allowedCompanyIds.includes(requestedCompanyId)) {
    return {
      ok: false,
      status: 403,
      data: null,
      error: { code: "COMPANY_NOT_ALLOWED", message: "Você não tem permissão para criar pedidos nesta empresa.", retryable: false }
    };
  }

  // 3. Resolver sellerId do banco
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("erp_seller_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.erp_seller_id) {
    return {
      ok: false,
      status: 422,
      data: null,
      error: { 
        code: "SELLER_NOT_MAPPED", 
        message: "Vendedor não mapeado para o ERP. Contate o administrador.", 
        retryable: false 
      }
    };
  }

  // Sobrescrever sellerId do payload com o valor real do banco
  // companyId é mantido conforme validado acima
  const finalPayload = {
    ...input,
    sellerId: profile.erp_seller_id
  };
  
  return callErp({
    method: "POST",
    path: "/api/v1/orders",
    body: finalPayload as unknown as JsonValue,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
  }) as Promise<ErpResponse<{ orderId: number; orderNumber: number; status: string }>>;
}

// --- PAYMENT OPTIONS ---
export interface PaymentTerm {
  id: number;
  code: string;
  description: string;
}

export interface PaymentMethod {
  id: number;
  description: string;
  type: string;
}

export interface SaleType {
  id: number;
  description: string;
}

export interface PaymentOptionsPayload {
  paymentTerms: PaymentTerm[];
  paymentMethods: PaymentMethod[];
  saleTypes: SaleType[];
}

export const getErpPaymentOptions = createServerFn({ method: "GET" })
  .handler(async () => {
    console.log("[SERVER-FN] Entering getErpPaymentOptions (v2 - diagnostic)");
    try {
      const { callErp } = await import("./erp.server");
      console.log("[SERVER-FN] Immediatly before callErp for payment-options");
      
      const result = await callErp({
        method: "GET",
        path: "/api/v1/payment-options"
      }) as ErpResponse<PaymentOptionsPayload>;
      
      console.log("[SERVER-FN] callErp result received:", {
        ok: result.ok,
        status: result.status,
        hasData: !!result.data,
        hasTerms: Array.isArray(result.data?.paymentTerms),
        termsCount: result.data?.paymentTerms?.length
      });
      
      return result;
    } catch (err: any) {
      console.error("[SERVER-FN] CRITICAL ERROR in getErpPaymentOptions:", err.message, err.stack);
      return {
        ok: false,
        status: 500,
        data: null,
        error: {
          code: "SERVER_FN_ERROR",
          message: err.message || "Erro interno na Server Function",
          retryable: true
        }
      };
    }
  });

export const getErpClientDetail = createServerFn({ method: "GET" })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: clientId }) => {
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: `/api/v1/clients/${clientId}`
    }) as Promise<ErpResponse<ErpClient & { defaultPaymentMethodId?: number; defaultPaymentTermId?: number; defaultSaleTypeId?: number }>>;
  });

