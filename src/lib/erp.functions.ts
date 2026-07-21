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