import { createServerFn } from "@tanstack/react-start";
import type { JsonValue } from "./erp.server";

// Client-safe: só exporta wrappers de createServerFn. NÃO importa erp.server
// no topo — o import ocorre dentro do handler para manter o client bundle limpo.

export interface ErpHealthPayload {
  service: string;
  status: string;
  version: string;
  environment: string;
  timestamp: string;
  [key: string]: JsonValue;
}

export interface ErpDbHealthPayload {
  status: string;
  database: string;
  timestamp: string;
  [key: string]: JsonValue;
}

export const pingErpHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { callErp } = await import("./erp.server");
  const res = await callErp<ErpHealthPayload>({
    method: "GET",
    path: "/api/v1/health",
  });
  return res;
});

export const pingErpDatabase = createServerFn({ method: "GET" }).handler(async () => {
  const { callErp } = await import("./erp.server");
  const res = await callErp<ErpDbHealthPayload>({
    method: "GET",
    path: "/api/v1/health/erp",
  });
  return res;
});

export interface OrderItem {
  [key: string]: JsonValue;
}

export interface OrderEquipment {
  [key: string]: JsonValue;
}

export interface Order {
  [key: string]: JsonValue;
}

export interface OrdersPayload {
  orders: Order[];
  count: number;
  [key: string]: JsonValue;
}

export interface ListOrdersInput {
  /** YYYY-MM-DD */
  date: string;
  /** Lista de empresas (1 = Graal, 3 = Grott). Omitir = retorna todas. */
  companies?: Array<1 | 3>;
}

function isValidDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [y, m, d] = input.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((input: ListOrdersInput) => {
    if (!input || typeof input.date !== "string" || !isValidDate(input.date)) {
      throw new Error("Parâmetro 'date' inválido. Use o formato YYYY-MM-DD.");
    }
    if (input.companies) {
      if (!Array.isArray(input.companies) || input.companies.length === 0) {
        throw new Error("Parâmetro 'companies' deve ser um array não vazio.");
      }
      for (const c of input.companies) {
        if (c !== 1 && c !== 3) {
          throw new Error("Empresas permitidas: 1 (Graal) e 3 (Grott).");
        }
      }
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const query: Record<string, string> = { date: data.date };
    if (data.companies && data.companies.length > 0) {
      query.companies = data.companies.join(",");
    }
    return callErp<OrdersPayload>({
      method: "GET",
      path: "/api/v1/operations/orders",
      query,
    });
  });

// ── Map / Geocoding (Fase 3C) ────────────────────────────────────────────

export interface MapOrderLocation {
  latitude: number | null;
  longitude: number | null;
  locationType: string;
  precision: string;
  placeId: string;
  matchMismatch: boolean;
  source: "cache" | "pending" | "unresolved";
  cacheKey: string;
}

/**
 * Endereço bruto do ERP. Nas respostas reais é SEMPRE objeto; a variante
 * string existe apenas como defesa histórica. Consumidores NÃO devem
 * renderizar diretamente — sempre passar por `normalizeMapOrder`.
 */
export type MapOrderAddress =
  | string
  | {
      street?: string | null;
      number?: string | null;
      complement?: string | null;
      neighborhood?: string | null;
      city?: string | null;
      state?: string | null;
    }
  | null;

export interface MapOrderItemRaw {
  productId?: number | null;
  product?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}

export interface MapOrderEquipmentRaw {
  typeId?: number | null;
  type?: string | null;
  quantity?: number | null;
}

/**
 * Pedido cru vindo do erp-api. Nomes seguem o contrato do backend
 * (clientName, expectedDelivery, observations, equipments). Não renderizar
 * campos deste tipo diretamente — usar `normalizeMapOrder`.
 */
export interface MapOrder {
  orderId?: number | null;
  orderNumber?: number | string | null;
  clientId?: number | null;
  clientName?: string | null;
  customerName?: string | null;
  phone?: string | null;
  companyId?: number | null;
  expectedDelivery?: string | null;
  expectedReturn?: string | null;
  deliveryDate?: string | null;
  period?: string | null;
  /** Horário de entrega "HH:mm" — backend v1.4.2+. Pode não existir. */
  deliveryTime?: string | null;
  observations?: string | null;
  notes?: string | null;
  erpStatus?: string | null;
  address?: MapOrderAddress;
  items?: MapOrderItemRaw[] | null;
  equipments?: MapOrderEquipmentRaw[] | null;
  equipment?: MapOrderEquipmentRaw[] | null;
  location?: MapOrderLocation | null;
}

export interface MapOrdersSummary {
  total: number;
  mapped: number;
  pending: number;
  unresolved: number;
}

export interface MapOrdersPayload {
  date: string;
  companyId: number | null;
  summary: MapOrdersSummary;
  orders: MapOrder[];
}

export interface GetMapOrdersInput {
  /** YYYY-MM-DD */
  date: string;
  /** 1 = Graal, 3 = Grott. Omitir = todas. */
  companyId?: 1 | 3;
}

// POST /api/v1/map/geocode — dispara geocodificação server-side para IDs
// internos de pedidos. O backend usa a chave Google (nunca o navegador).
export interface GeocodeOrdersInput {
  orderIds: number[];
}

// ── Normalização defensiva ───────────────────────────────────────────────
// Toda UI consome `NormalizedMapOrder`. Uma linha malformada é marcada com
// `malformed: true` e recebe defaults seguros — nunca derruba a página.

export interface NormalizedAddress {
  formatted: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export interface NormalizedItem {
  productId: number | null;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface NormalizedEquipment {
  typeId: number | null;
  type: string;
  quantity: number;
}

export interface NormalizedMapOrder {
  key: string;
  erpOrderId: number;
  orderNumber: string;
  companyId: number | null;
  customerName: string;
  phone: string | null;
  address: NormalizedAddress;
  observations: string | null;
  erpStatus: string | null;
  deliveryDate: string | null;
  returnDate: string | null;
  period: string | null;
  /** "HH:mm" ou null. Frontend nunca inventa horário. */
  deliveryTime: string | null;
  items: NormalizedItem[];
  equipments: NormalizedEquipment[];
  location: MapOrderLocation;
  malformed: boolean;
  raw: MapOrder;
}

const EMPTY_LOCATION: MapOrderLocation = {
  latitude: null,
  longitude: null,
  locationType: "",
  precision: "",
  placeId: "",
  matchMismatch: false,
  source: "unresolved",
  cacheKey: "",
};

/**
 * Helper único: um pedido é mapeável quando (e somente quando) possui
 * latitude e longitude numéricas. Endereço é sempre obrigatório; location
 * é enriquecimento opcional. Nenhum fluxo operacional deve depender disto.
 */
export function isMappable(
  order: Pick<NormalizedMapOrder, "location"> | { location?: MapOrderLocation | null } | null | undefined,
): boolean {
  const loc = order?.location;
  return (
    typeof loc?.latitude === "number" &&
    Number.isFinite(loc.latitude) &&
    typeof loc?.longitude === "number" &&
    Number.isFinite(loc.longitude)
  );
}

const EMPTY_ADDRESS: NormalizedAddress = {
  formatted: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function sOrNull(v: unknown): string | null {
  const t = s(v);
  return t === "" ? null : t;
}
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function nOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizeMapOrder(raw: MapOrder, idx: number): NormalizedMapOrder {
  try {
    const erpOrderId = Number(raw?.orderId ?? raw?.orderNumber ?? 0) || 0;
    const orderNumber = s(raw?.orderNumber ?? raw?.orderId) || "—";
    const customerName = s(raw?.customerName) || s(raw?.clientName) || "(sem cliente)";
    const phone = sOrNull(raw?.phone);
    const companyId =
      raw?.companyId === 1 || raw?.companyId === 3 ? raw.companyId : null;

    const a = raw?.address;
    let street = "";
    let number = "";
    let complement = "";
    let district = "";
    let city = "";
    let state = "";
    if (typeof a === "string") {
      street = a.trim();
    } else if (a && typeof a === "object") {
      const obj = a as Record<string, unknown>;
      street = s(obj.street);
      number = s(obj.number);
      complement = s(obj.complement);
      district = s(obj.neighborhood);
      city = s(obj.city);
      state = s(obj.state);
    }
    const streetLine = [street, number].filter(Boolean).join(", ");
    const line1 = complement
      ? [streetLine, complement].filter(Boolean).join(" — ")
      : streetLine;
    const cityState = city && state ? `${city} — ${state}` : city || state;
    const line2 = [district, cityState].filter(Boolean).join(" · ");
    const formatted = [line1, line2].filter(Boolean).join(" · ");

    const itemsSrc = Array.isArray(raw?.items) ? raw.items : [];
    const items: NormalizedItem[] = itemsSrc.map((it) => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      return {
        productId: nOrNull(o.productId),
        product: s(o.product),
        quantity: n(o.quantity),
        unitPrice: n(o.unitPrice),
        total: n(o.total),
      };
    });

    const eqSrc = Array.isArray(raw?.equipments)
      ? raw.equipments
      : Array.isArray(raw?.equipment)
        ? raw.equipment
        : [];
    const equipments: NormalizedEquipment[] = eqSrc.map((it) => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      return {
        typeId: nOrNull(o.typeId),
        type: s(o.type),
        quantity: n(o.quantity),
      };
    });

    const location: MapOrderLocation = raw?.location ?? EMPTY_LOCATION;

    return {
      key: String(erpOrderId || raw?.orderNumber || `row-${idx}`),
      erpOrderId,
      orderNumber,
      companyId,
      customerName,
      phone,
      address: { formatted, street, number, complement, district, city, state },
      observations: sOrNull(raw?.observations ?? raw?.notes),
      erpStatus: sOrNull(raw?.erpStatus),
      deliveryDate: sOrNull(raw?.expectedDelivery ?? raw?.deliveryDate),
      returnDate: sOrNull(raw?.expectedReturn),
      period: sOrNull(raw?.period),
      deliveryTime: sOrNull(raw?.deliveryTime),
      items,
      equipments,
      location,
      malformed: false,
      raw,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[normalizeMapOrder] pedido malformado — placeholder aplicado", {
      idx,
      message: (err as Error)?.message,
    });
    return {
      key: `malformed-${idx}`,
      erpOrderId: 0,
      orderNumber: "—",
      companyId: null,
      customerName: "(dados incompletos)",
      phone: null,
      address: EMPTY_ADDRESS,
      observations: null,
      erpStatus: null,
      deliveryDate: null,
      returnDate: null,
      period: null,
      deliveryTime: null,
      items: [],
      equipments: [],
      location: EMPTY_LOCATION,
      malformed: true,
      raw,
    };
  }
}

export const getMapOrders = createServerFn({ method: "GET" })
  .inputValidator((input: GetMapOrdersInput) => {
    if (!input || typeof input.date !== "string" || !isValidDate(input.date)) {
      throw new Error("Parâmetro 'date' inválido. Use o formato YYYY-MM-DD.");
    }
    if (input.companyId !== undefined && input.companyId !== 1 && input.companyId !== 3) {
      throw new Error("Empresa permitida: 1 (Graal) ou 3 (Grott).");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const query: Record<string, string> = { date: data.date };
    if (data.companyId) query.companyId = String(data.companyId);
    const res = await callErp<JsonValue>({
      method: "GET",
      path: "/api/v1/map/orders",
      query,
    });
    return res as unknown as {
      ok: boolean;
      status: number;
      data: MapOrdersPayload | null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        details?: JsonValue;
      } | null;
    };
  });

export const geocodeOrders = createServerFn({ method: "POST" })
  .inputValidator((input: GeocodeOrdersInput) => {
    if (!input || !Array.isArray(input.orderIds)) {
      throw new Error("orderIds obrigatório (array de inteiros).");
    }
    // Sanitiza: apenas inteiros positivos, remove nulos/duplicados.
    const seen = new Set<number>();
    const clean: number[] = [];
    for (const raw of input.orderIds) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      clean.push(n);
    }
    if (clean.length === 0) {
      throw new Error("orderIds vazio após sanitização.");
    }
    return { orderIds: clean };
  })
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    return callErp<JsonValue>({
      method: "POST",
      path: "/api/v1/map/geocode",
      body: { orderIds: data.orderIds } as unknown as JsonValue,
    });
  });

// ── Catálogo somente leitura do ERP (v1.6.0) ─────────────────────────────

export interface ErpProduct {
  id: number | null;
  code: string | null;
  description: string | null;
  unit?: { id: number | null; code: string | null; description: string | null } | null;
  group?: { id: number | null; description: string | null } | null;
  companyId: number | null;
  active: boolean | null;
  blocked: boolean | null;
  discontinued: boolean | null;
}

export interface ErpProductsPayload {
  count: number;
  limit: number;
  nextCursor: string | null;
  products: ErpProduct[];
}

export interface ErpEquipmentType {
  id: number | null;
  code: string | null;
  description: string | null;
  companyId: number | null;
  active: boolean | null;
  category: string | null;
  returnable: boolean | null;
}

export interface ErpEquipmentTypesPayload {
  count: number;
  scanned: number;
  limit: number;
  truncated: boolean;
  equipmentTypes: ErpEquipmentType[];
}

export interface SearchProductsInput {
  /** Termo de busca (3 a 60 caracteres). Obrigatório: a API exige ao menos um filtro. */
  q: string;
  companyId?: 1 | 3;
  active?: boolean;
  limit?: number;
  cursor?: string;
  isAdminSearch?: boolean;
}

export interface ErpEnvelope<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: { code: string; message: string; retryable: boolean; details?: JsonValue } | null;
}

export const searchErpProducts = createServerFn({ method: "POST" })
  .inputValidator((input: SearchProductsInput) => {
    const q = typeof input?.q === "string" ? input.q.trim() : "";
    // No Novo Pedido, q pode ser vazio para listar habilitados. 
    // Se preenchido, deve ter min 3 para não ser barrado pela API Node.
    if (q !== "" && (q.length < 3 || q.length > 60)) {
      throw new Error("Informe de 3 a 60 caracteres na busca.");
    }
    if (input.companyId !== undefined && input.companyId !== 1 && input.companyId !== 3) {
      throw new Error("Empresa permitida: 1 (Graal) ou 3 (Grott).");
    }
    const limit = Number.isFinite(input.limit) ? Math.min(Math.max(Number(input.limit), 1), 50) : 20;
    const cursor = typeof input.cursor === "string" && input.cursor.trim() !== "" ? input.cursor.trim() : undefined;
    return { q, companyId: input.companyId, active: input.active, limit, cursor, isAdminSearch: !!input.isAdminSearch };
  })
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar habilitados no Supabase se não for busca administrativa
    let enabledIds: number[] = [];
    if (!data.isAdminSearch) {
      const { data: enabledProducts } = await supabaseAdmin
        .from("order_catalog_settings")
        .select("erp_item_id")
        .eq("item_type", "product")
        .eq("enabled", true)
        .contains("company_ids", [data.companyId || 1]);
      enabledIds = (enabledProducts || []).map((p: any) => p.erp_item_id);
    }
    const query: Record<string, string> = { q: data.q, limit: String(data.limit) };
    if (data.companyId) query.companyId = String(data.companyId);
    if (typeof data.active === "boolean") query.active = String(data.active);
    if (data.cursor) query.cursor = data.cursor;
    const res = await callErp<JsonValue>({
      method: "GET",
      path: "/api/v1/products",
      query,
    });
    const finalRes = res as unknown as ErpEnvelope<ErpProductsPayload>;
    if (finalRes.ok && finalRes.data && !data.isAdminSearch) {
      finalRes.data.products = finalRes.data.products.filter((p) => 
        p.id !== null && enabledIds.includes(p.id)
      );
    }
    return finalRes;
  });

export interface ListEquipmentTypesInput {
  q?: string;
  active?: boolean;
  limit?: number;
  companyId?: 1 | 3;
  isAdminSearch?: boolean;
}

export const listErpEquipmentTypes = createServerFn({ method: "POST" })
  .inputValidator((input: ListEquipmentTypesInput | undefined) => {
    const raw = typeof input?.q === "string" ? input.q.trim() : "";
    if (raw !== "" && (raw.length < 2 || raw.length > 60)) {
      throw new Error("A busca deve ter de 2 a 60 caracteres.");
    }
    const limit = Number.isFinite(input?.limit) ? Math.min(Math.max(Number(input?.limit), 1), 200) : 200;
    return { q: raw === "" ? undefined : raw, active: input?.active, limit, companyId: input?.companyId, isAdminSearch: !!input?.isAdminSearch };
  })
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar habilitados no Supabase se não for busca administrativa
    let enabledIds: number[] = [];
    if (!data.isAdminSearch) {
      const { data: enabledEquips } = await supabaseAdmin
        .from("order_catalog_settings")
        .select("erp_item_id")
        .eq("item_type", "equipment")
        .eq("enabled", true)
        .contains("company_ids", [data.companyId || 1]);
      enabledIds = (enabledEquips || []).map((p: any) => p.erp_item_id);
    }
    const query: Record<string, string> = { limit: String(data.limit) };
    if (data.q) query.q = data.q;
    if (typeof data.active === "boolean") query.active = String(data.active);
    const res = await callErp<JsonValue>({
      method: "GET",
      path: "/api/v1/equipment-types",
      query,
    });
    const finalRes = res as unknown as ErpEnvelope<ErpEquipmentTypesPayload>;
    if (finalRes.ok && finalRes.data && !data.isAdminSearch) {
      const list = Array.isArray(finalRes.data.equipmentTypes) ? finalRes.data.equipmentTypes : [];
      finalRes.data.equipmentTypes = list.filter((et) => 
        et.id !== null && enabledIds.includes(et.id)
      );
    }
    return finalRes;
  });