import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { JsonValue } from "./erp.server";

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
}

export const searchErpClients = createServerFn({ method: "GET" })
  .inputValidator((d) => 
    z.object({
      q: z.string().min(3),
      companyId: z.union([z.literal(1), z.literal(3)]).optional(),
      limit: z.number().optional().default(20),
      cursor: z.number().optional()
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    return callErp({
      method: "GET",
      path: "/api/v1/clients",
      query: data as any
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
  companyId: 1 | 3;
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
  items: Array<{ productId: number; quantity: number }>;
  equipments: Array<{ equipmentTypeId: number; quantity: number }>;
}

export const createErpOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { data: CreateOrderInput; idempotencyKey?: string }) => d)
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    
    return callErp({
      method: "POST",
      path: "/api/v1/orders",
      body: data.data as unknown as JsonValue,
      headers: data.idempotencyKey ? { "x-idempotency-key": data.idempotencyKey } : undefined
    }) as Promise<ErpResponse<{ orderId: number; orderNumber: number; status: string }>>;
  });
