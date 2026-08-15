import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listOrders,
  pingErpDatabase,
  pingErpHealth,
  getMapOrders,
  geocodeOrders,
  searchErpProducts,
  listErpEquipmentTypes,
  type ListOrdersInput,
  type GetMapOrdersInput,
  type GeocodeOrdersInput,
  type SearchProductsInput,
  type ListEquipmentTypesInput,
  type ErpProductsPayload,
} from "@/lib/erp.functions";
import {
  searchErpClients,
  resolveErpPrice,
  createErpOrder,
  getErpPaymentOptions,
  getErpClientDetail,
  getErpOrderDetail,
  getErpCustomerGroups,
  createErpClient,
  type CreateOrderInput,
  type ErpResponse,
  type ErpProduct,
  type ErpEquipmentType,
  type PaymentOptionsPayload,
  type ErpClient,
  type ErpOrderDetail,
} from "@/lib/erp-orders.functions";


/** Ping público /api/v1/health da API Node. */
export function useErpHealth() {
  const fn = useServerFn(pingErpHealth);
  return useQuery({
    queryKey: ["erp", "health"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

/** Ping autenticado /api/v1/health/erp (verifica conexão com o Firebird). */
export function useErpDatabaseHealth(options?: { enabled?: boolean }) {
  const fn = useServerFn(pingErpDatabase);
  return useQuery({
    queryKey: ["erp", "health", "db"],
    queryFn: () => fn(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Lista pedidos para entrega em uma data (opcionalmente filtrada por empresa). */
export function useListOrders(input: ListOrdersInput | null) {
  const fn = useServerFn(listOrders);
  return useQuery({
    queryKey: ["erp", "orders", input?.date, input?.companies?.join(",") ?? "all"],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input });
    },
    enabled: Boolean(input?.date),
  });
}

/** Versão mutation, útil para chamar via botão/handler. */
export function useListOrdersMutation() {
  const fn = useServerFn(listOrders);
  return useMutation({
    mutationFn: (input: ListOrdersInput) => fn({ data: input }),
  });
}

/** GET /api/v1/map/orders — pedidos com location resolvido a partir do cache. */
export function useMapOrders(input: GetMapOrdersInput | null) {
  const fn = useServerFn(getMapOrders);
  return useQuery({
    queryKey: ["erp", "map", "orders", input?.date, input?.companyId ?? "all"],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input });
    },
    enabled: Boolean(input?.date),
    staleTime: 15_000,
  });
}

/** POST /api/v1/map/geocode — dispara geocodificação para IDs internos. */
export function useGeocodeOrders() {
  const fn = useServerFn(geocodeOrders);
  return useMutation({
    mutationFn: (input: GeocodeOrdersInput) => fn({ data: input }),
  });
}

/** GET /api/v1/products — busca direta no ERP para configuração do catálogo. */
export function useErpProducts(input: { q?: string; companyId?: 1 | 3; limit?: number; cursor?: string; isAdminSearch?: boolean }) {
  const fn = useServerFn(searchErpProducts);
  const query = input.q?.trim() || "";
  
  return useQuery({
    queryKey: [
      "erp",
      "products",
      "catalog", // Sprint 8.5.9: Alterado de 'search' para 'catalog' para refletir a nova regra
      query,
      input.companyId,
      input.cursor ?? "",
      !!input.isAdminSearch,
    ],
    queryFn: async (): Promise<ErpResponse<ErpProductsPayload>> => {
      // Sprint 8.5.9: No Novo Pedido, NÃO enviamos termo de busca para o servidor. 
      // O servidor retorna o catálogo completo e o filtro é local.
      const searchTerm = input.isAdminSearch ? query : "";

      if (!searchTerm && input.isAdminSearch) {
        return { 
          ok: true, 
          data: { products: [], nextCursor: null, count: 0, limit: input.limit ?? 50 }, 
          status: 200, 
          error: null 
        };
      }
      return fn({ data: { ...input, q: searchTerm } }) as Promise<ErpResponse<ErpProductsPayload>>;
    },
    // No Novo Pedido (catalog), está sempre habilitado para carregar a lista inicial.
    enabled: !input.isAdminSearch || query.length >= 3,
    staleTime: 60_000,
  });
}

/** GET /api/v1/equipment-types — catálogo pequeno do ERP filtrado pelo Supabase. */
export function useErpEquipmentTypes(input: { q?: string; active?: boolean; companyId?: 1 | 3; isAdminSearch?: boolean }) {
  const fn = useServerFn(listErpEquipmentTypes);
  return useQuery({
    queryKey: [
      "erp",
      "equipment-types",
      input.q ?? "",
      input.active ?? "all",
      input.companyId,
      !!input.isAdminSearch,
    ],
    queryFn: () => fn({ data: input }),
    staleTime: 60_000,
  });
}

/** Busca clientes no ERP por nome, documento, código ou telefone. */
export function useErpClients(input: { q?: string; document?: string; phone?: string; companyId?: 1 | 3; limit?: number; cursor?: number } | null) {
  const fn = useServerFn(searchErpClients);
  return useQuery({
    queryKey: ["erp", "clients", input?.q ?? "", input?.document ?? "", input?.phone ?? "", input?.companyId ?? "all"],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input });
    },
    enabled: Boolean(input?.companyId) && (input?.q?.trim().length ?? 0) >= 3,
    staleTime: 30_000,
  });
}

/** Resolve o preço de um produto para um cliente específico. */
export function useErpPrice(input: { productId: number; clientId: number } | null) {
  const fn = useServerFn(resolveErpPrice);
  return useQuery({
    queryKey: ["erp", "pricing", input?.productId, input?.clientId],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input });
    },
    enabled: Boolean(input?.productId && input?.clientId),
    staleTime: 60_000,
  });
}

/** POST /api/v1/orders — cria pedido real no Firebird. */
export function useCreateErpOrder() {
  const fn = useServerFn(createErpOrder);
  return useMutation({
    mutationFn: (args: { data: CreateOrderInput; idempotencyKey: string }) => 
      fn({ 
        data: args 
      }),
  });
}

/** GET /api/v1/payment-options — opções globais de pagamento do ERP. */
export function useErpPaymentOptions() {
  const fn = useServerFn(getErpPaymentOptions);
  return useQuery({
    queryKey: ["erp", "payment-options"],
    queryFn: async () => {
      console.log("[HOOK] useErpPaymentOptions queryFn triggered");
      const result = await fn();
      console.log("[HOOK] useErpPaymentOptions result:", result.ok ? "SUCCESS" : "ERROR");
      return result;
    },
    staleTime: 3600_000, 
    retry: 1,
  });
}

/** GET /api/v1/clients/:id — detalhe do cliente com defaults de pagamento. */
export function useErpClientDetail(clientId: number | null) {
  const fn = useServerFn(getErpClientDetail);
  return useQuery({
    queryKey: ["erp", "clients", clientId, "detail"],
    queryFn: () => {
      if (!clientId) throw new Error("clientId ausente");
      return fn({ data: clientId });
    },
    enabled: Boolean(clientId),
    staleTime: 60_000,
  });
}

/** GET /api/v1/orders/:orderNumber — detalhe completo do pedido para edição. */
export function useErpOrderDetail(orderNumber: number | null) {
  const fn = useServerFn(getErpOrderDetail);
  return useQuery({
    queryKey: ["erp", "orders", orderNumber, "detail"],
    queryFn: () => {
      if (!orderNumber) throw new Error("orderNumber ausente");
      return fn({ data: orderNumber });
    },
    enabled: Boolean(orderNumber),
    staleTime: 0, // Edição exige dados frescos
  });
}

/** GET /api/v1/customer-groups — lista de grupos de clientes. */
export function useErpCustomerGroups() {
  const fn = useServerFn(getErpCustomerGroups);
  return useQuery({
    queryKey: ["erp", "customer-groups"],
    queryFn: () => fn(),
    staleTime: 3600_000,
  });
}

/** POST /api/v1/clients — cadastra novo cliente no ERP. */
export function useCreateErpClient() {
  const fn = useServerFn(createErpClient);
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
  });
}

