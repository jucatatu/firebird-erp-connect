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
} from "@/lib/erp.functions";
import {
  searchErpClients,
  resolveErpPrice,
  createErpOrder,
  type CreateOrderInput,
  type ErpResponse,
  type ErpProduct,
  type ErpEquipmentType,
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

/** GET /api/v1/products — catálogo somente leitura do ERP. Exige termo de busca. */
export function useErpProducts(input: SearchProductsInput | null) {
  const fn = useServerFn(searchErpProducts);
  return useQuery({
    queryKey: [
      "erp",
      "products",
      input?.q ?? "",
      input?.companyId ?? "all",
      input?.active ?? "any",
      input?.cursor ?? "",
    ],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input }) as Promise<ErpResponse<{ products: ErpProduct[]; nextCursor: number | null }>>;
    },
    enabled: Boolean(input && input.q.trim().length >= 3),
    staleTime: 60_000,
  });
}

/** GET /api/v1/equipment-types — catálogo pequeno, carregado inteiro. */
export function useErpEquipmentTypes(input?: ListEquipmentTypesInput) {
  const fn = useServerFn(listErpEquipmentTypes);
  return useQuery({
    queryKey: ["erp", "equipment-types", input?.q ?? "", input?.active ?? "any", input?.companyId ?? "all"],
    queryFn: () => fn({ data: input ?? {} }),
    staleTime: 60_000,
  });
}

/** Busca clientes no ERP por nome, documento, código ou telefone. */
export function useErpClients(input: { q: string; companyId?: 1 | 3; limit?: number; cursor?: number } | null) {
  const fn = useServerFn(searchErpClients);
  return useQuery({
    queryKey: ["erp", "clients", input?.q ?? "", input?.companyId ?? "all"],
    queryFn: () => {
      if (!input) throw new Error("input ausente");
      return fn({ data: input });
    },
    enabled: Boolean(input && input.q.trim().length >= 3),
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
