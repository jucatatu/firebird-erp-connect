import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

export const EDITABLE_ERP_ORDER_STATUSES = [1, 20, 24, 27];

export function canEditErpOrder(statusId: number | string | null | undefined): boolean {
  if (statusId === null || statusId === undefined) return false;
  const id = Number(statusId);
  return EDITABLE_ERP_ORDER_STATUSES.includes(id);
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
  client_snapshot?: {
    id: number;
    name: string;
    fantasyName?: string | null;
  };
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
  deliveryAddress?: any;
  deliveryAddressConfirmed?: boolean;
  deliveryAddressSource?: "client" | "custom";

  items: Array<{ 
    productId: number; 
    description?: string;
    quantity: number;
    unit?: string;
    manualUnitPrice?: number; 
  }>;
  equipments: Array<{ 
    equipmentTypeId: number; 
    description?: string;
    quantity: number; 
  }>;
}

/**
 * Sprint 8.9.21: Construtor de Payload Estrito (ERP API Contract)
 * Fonte da Verdade: erp-api/src/modules/orders/orders.validator.js
 */
function buildErpCreateOrderPayload(input: CreateOrderInput, sellerId: number) {
  return {
    companyId: input.companyId,
    clientId: input.clientId,
    sellerId: sellerId,
    saleTypeId: input.saleTypeId,
    paymentTermId: input.paymentTermId,
    paymentMethodId: input.paymentMethodId,
    deliver: input.deliver,
    deliveryAt: input.deliveryAt.includes('T') ? input.deliveryAt.split('T')[0] : input.deliveryAt,
    returnEquipment: input.returnEquipment,
    returnAt: (input.returnAt && input.returnAt.includes('T')) ? input.returnAt.split('T')[0] : (input.returnAt || null),

    freightValue: input.freightValue ?? 0,
    notes: input.notes ?? null,
    // deliveryAddress: NÃO vazar para o payload estrito se o ERP não aceita.
    // Sprint 8.9.38: O contrato do ERP Node é estrito. 
    // Se o backend Node não foi alterado para aceitar esses campos, não enviamos.
    // Auditar se o Node aceita 'deliveryAddress' (provavelmente não, ou apenas campos específicos).
    // Vou remover o envio desses campos operacionais de UI para o ERP.
    // Manter apenas o essencial que o ERP espera (baseado no validator do Node).

    items: input.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      manualUnitPrice: item.manualUnitPrice ?? null
    })),
    equipments: input.equipments.map(eq => ({
      equipmentTypeId: eq.equipmentTypeId,
      quantity: eq.quantity
    }))
  };
}

export const createErpOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { data: CreateOrderInput; idempotencyKey?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return handleCreateErpOrder(data.data, data.idempotencyKey, context.userId, supabaseAdmin);
  });

/**
 * Lógica interna testável sem dependência de AsyncLocalStorage do createServerFn.
 */
export async function handleCreateErpOrder(
  input: CreateOrderInput,
  idempotencyKey: string | undefined,
  userId: string,
  supabaseAdmin: any
): Promise<ErpResponse<{ orderId: number; orderNumber: number; status: string; mirrorId?: string }>> {
  const { callErp } = await import("./erp.server");

  console.log("[ORDER SERVER] authenticated user resolved:", userId);

  // 1. Resolver o sellerId e validar empresa (mantido conforme auditoria)
  const { data: userCompanies, error: ucaErr } = await supabaseAdmin
    .from("user_company_access")
    .select("company_id")
    .eq("user_id", userId);
  
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

  if (![1, 3].includes(requestedCompanyId)) {
    return { ok: false, status: 400, data: null, error: { code: "INVALID_COMPANY", message: "ID de empresa inválido.", retryable: false } };
  }

  if (!allowedCompanyIds.includes(requestedCompanyId)) {
    return { ok: false, status: 403, data: null, error: { code: "COMPANY_NOT_ALLOWED", message: "Sem permissão para esta empresa.", retryable: false } };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("erp_seller_id")
    .eq("id", userId)
    .single();
  
  if (profileErr || !profile?.erp_seller_id) {
    return { ok: false, status: 422, data: null, error: { code: "SELLER_NOT_MAPPED", message: "Vendedor não mapeado.", retryable: false } };
  }

  const erpPayload = buildErpCreateOrderPayload(input, profile.erp_seller_id);

  console.log("[ORDER SAVE] start");
  console.log("[ORDER SAVE] ERP payload built", JSON.stringify(erpPayload));
  
  console.log("[ORDER SAVE] POST started");
  const result = await callErp({
    method: "POST",
    path: "/api/v1/orders",
    body: erpPayload as unknown as JsonValue,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
  }) as ErpResponse<{ orderId: number; orderNumber: number; status: string }>;

  console.log("[ORDER SAVE] POST response", { 
    ok: result.ok, 
    status: result.status,
    orderNumber: result.data?.orderNumber
  });

  if (!result.ok || !result.data) return result;

  console.log("[ORDER SAVE] snapshot started", { 
    orderNumber: result.data.orderNumber,
    orderId: result.data.orderId
  });

  // Sprint 8.9.5: Espelho Operacional (Mirror)
  // Como a constraint erp_order_id_uniq é parcial (WHERE IS NOT NULL), o PostgREST/Supabase
  // pode ter dificuldade com UPSERT sem especificar a constraint exata ou se houver conflito de RLS.
  // Usamos uma estratégia de "Select then Insert/Update" para maior robustez server-side.
  try {
    const { data: existingMirror } = await supabaseAdmin
      .from("order_drafts")
      .select("id")
      .eq("erp_order_id", result.data.orderId)
      .maybeSingle();

    const mirrorPayload = {
      created_by: userId,
      updated_by: userId,
      status: "sent",
      title: input.notes?.split('\n')[0].substring(0, 100) || "Pedido ERP",
      customer_name_snapshot: input.client_snapshot?.fantasyName 
        ? `${input.client_snapshot.fantasyName}\n${input.client_snapshot.name}` 
        : (input.client_snapshot?.name || "Pedido ERP"),
      company_id: requestedCompanyId,
      erp_order_id: result.data.orderId,
      erp_order_number: result.data.orderNumber,
      sent_at: new Date().toISOString(),
      payload: {
        ...input,
        erp_response: result.data,
        mirrored_at: new Date().toISOString()
      },
      // Sprint 8.9.39.1: Persistir snapshot operacional detalhado no payload_v2 para auditoria
      payload_v2: {
        items: input.items,
        equipments: input.equipments, // Aqui já contém role, capacityLiters, assignedProductId se vindo da store
        deliveryAddress: input.deliveryAddress,
        deliveryAddressSource: input.deliveryAddressSource
      },
      idempotency_key: idempotencyKey || crypto.randomUUID()
    };

    let mirrorId: string;
    if (existingMirror) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("order_drafts")
        .update(mirrorPayload)
        .eq("id", existingMirror.id)
        .select("id")
        .single();
      
      if (updateErr) throw updateErr;
      mirrorId = updated.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("order_drafts")
        .insert(mirrorPayload)
        .select("id")
        .single();
      
      if (insertErr) throw insertErr;
      mirrorId = inserted.id;
    }

    console.log("[ORDER SAVE] snapshot response success:", mirrorId);
    console.log("[ORDER SAVE] finished");
    return {
      ...result,
      data: { ...result.data, mirrorId }
    };
  } catch (err: any) {
    console.error("[ORDER SERVER] Mirror exception:", err);
    return {
      ...result,
      data: { ...result.data, mirrorId: undefined },
      error: { 
        code: "ORDER_CREATED_MIRROR_FAILED", 
        message: "Pedido criado no ERP, mas falha crítica no espelho Supabase.",
        retryable: true
      }
    };
  }
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
export const updateErpOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderNumber: number; data: CreateOrderInput }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callErp } = await import("./erp.server");
    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("erp_seller_id")
      .eq("id", userId)
      .single();
    
    if (!profile?.erp_seller_id) {
      return { ok: false, status: 422, data: null, error: { code: "SELLER_NOT_MAPPED", message: "Vendedor não mapeado.", retryable: false } };
    }

    const erpPayload = buildErpCreateOrderPayload(data.data, profile.erp_seller_id);

    const result = await callErp({
      method: "PUT",
      path: `/api/v1/orders/${data.orderNumber}`,
      body: erpPayload as any
    }) as ErpResponse<{ orderId: number; orderNumber: number; status: string }>;

    if (!result.ok) return result;

    if (result.ok && result.data) {
      await supabaseAdmin
        .from("order_drafts")
        .update({
          updated_by: userId,
          customer_name_snapshot: data.data.client_snapshot?.fantasyName 
            ? `${data.data.client_snapshot.fantasyName}\n${data.data.client_snapshot.name}` 
            : (data.data.client_snapshot?.name || "Pedido ERP"),
          company_id: data.data.companyId,
          payload: {
            ...data.data,
            erp_response: result.data,
            updated_at: new Date().toISOString()
          },
          payload_v2: {
            items: data.data.items,
            equipments: data.data.equipments,
            deliveryAddress: data.data.deliveryAddress,
            deliveryAddressSource: data.data.deliveryAddressSource
          }
        })
        .eq("erp_order_id", result.data.orderId);
    }

    return result;
  });


export interface ErpOrderStatus {
  orderId: number;
  orderNumber: number;
  statusId: number;
  statusDescription: string | null;
  canEdit: boolean;
}


export const getErpOrdersStatus = createServerFn({ method: "GET" })
  .inputValidator((ids: number[]) => z.array(z.number()).parse(ids))
  .handler(async ({ data: orderIds }) => {
    if (orderIds.length === 0) return { ok: true, status: 200, data: [], error: null };
    
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: "/api/v1/orders/batch-status",
      query: { orderIds: orderIds.join(",") }
    }) as Promise<ErpResponse<ErpOrderStatus[]>>;
  });

export interface ErpOrderDetail extends Omit<CreateOrderInput, 'items'> {
  orderId: number;
  orderNumber: number;
  statusId: number;
  statusDescription: string | null;
  items: Array<{
    productId: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    manualUnitPrice: number | null;
  }>;
  equipments: Array<{
    equipmentTypeId: number;
    description: string;
    quantity: number;
  }>;
}

export const getErpOrderDetail = createServerFn({ method: "GET" })
  .inputValidator((orderNumber: number) => z.number().parse(orderNumber))
  .handler(async ({ data: orderNumber }) => {
    const { callErp } = await import("./erp.server");
    const result = await callErp({
      method: "GET",
      path: `/api/v1/orders/${orderNumber}`
    }) as ErpResponse<any>;

    if (!result.ok || !result.data) return result;

    const raw = result.data;
    // Mapeamento exato do contrato Node (orders.repository.js / orders.mapper.js) para CreateOrderInput
    // O backend retorna campos em camelCase pois é orquestrado pelo service/mapper
    const mapped: ErpOrderDetail = {
      orderId: Number(raw.ID_ORDENS_VENDA || raw.orderId),
      orderNumber: Number(raw.N_PEDIDO || raw.orderNumber),
      statusId: Number(raw.ID_STATUS || raw.statusId),
      statusDescription: raw.STATUS_DESCRICAO || raw.statusDescription,
      companyId: Number(raw.ID_EMPRESA || raw.companyId),
      clientId: Number(raw.ID_CLIENTE || raw.clientId),
      sellerId: Number(raw.ID_VENDEDOR || raw.sellerId),
      saleTypeId: Number(raw.ID_TIPO_VENDA || raw.saleTypeId),
      paymentTermId: Number(raw.ID_PRAZO_PAGTO || raw.paymentTermId),
      paymentMethodId: Number(raw.ID_FORMA_PAGTO || raw.paymentMethodId),
      deliver: raw.ENTREGAR === 1 || raw.deliver === true,
      deliveryAt: raw.DATA_ENTREGA || raw.deliveryAt,
      returnEquipment: raw.RECOLHER_EQUIPAMENTO === 1 || raw.returnEquipment === true,
      returnAt: raw.DATA_RECOLHIMENTO || raw.returnAt,
      notes: raw.OBSERVACAO || raw.notes,
      freightValue: Number(raw.VALOR_FRETE || raw.freightValue || 0),
      items: (raw.items || []).map((i: any) => ({
        productId: Number(i.ID_PRODUTO || i.productId),
        description: i.DESCRICAO || i.description,
        quantity: Number(i.QUANTIDADE || i.quantity),
        unit: i.UNIDADE || i.unit,
        unitPrice: Number(i.PRECO_TABELA || i.unitPrice), // Preço "original" de tabela na época ou atual
        manualUnitPrice: i.PRECO_UNITARIO !== i.PRECO_TABELA ? Number(i.PRECO_UNITARIO || i.manualUnitPrice) : null
      })),
      equipments: (raw.equipments || []).map((e: any) => ({
        equipmentTypeId: Number(e.ID_TIPO_EQUIPAMENTO || e.equipmentTypeId),
        description: e.DESCRICAO || e.description,
        quantity: Number(e.QUANTIDADE || e.quantity)
      }))
    };

    return { ...result, data: mapped };
  });



