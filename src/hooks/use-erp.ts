import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listOrders,
  pingErpDatabase,
  pingErpHealth,
  type ListOrdersInput,
} from "@/lib/erp.functions";

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