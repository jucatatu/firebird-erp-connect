import { createServerFn } from "@tanstack/react-start";

// Client-safe: só exporta wrappers de createServerFn. NÃO importa erp.server
// no topo — o import ocorre dentro do handler para manter o client bundle limpo.

export interface ErpHealthPayload {
  service: string;
  status: string;
  version: string;
  environment: string;
  timestamp: string;
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
  const res = await callErp<{ status: string; database: string; timestamp: string }>({
    method: "GET",
    path: "/api/v1/health/erp",
  });
  return res;
});

export interface OrderItem {
  id?: number | string;
  descricao?: string;
  quantidade?: number;
  precoUnit?: number;
  valorItem?: number;
  [key: string]: unknown;
}

export interface OrderEquipment {
  id?: number | string;
  descricao?: string;
  tipoEquipamentoId?: number | string;
  [key: string]: unknown;
}

export interface Order {
  orderId: number | string;
  numeroPedido: number | string;
  dataPrevEntrega: string | null;
  observacao: string | null;
  numero: string | null;
  complemento: string | null;
  companyId: 1 | 3;
  clienteId?: number | string | null;
  clienteNome?: string | null;
  telefone?: string | null;
  itens: OrderItem[];
  equipamentos: OrderEquipment[];
  [key: string]: unknown;
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
    return callErp<{ orders: Order[]; count: number }>({
      method: "GET",
      path: "/api/v1/operations/orders",
      query,
    });
  });