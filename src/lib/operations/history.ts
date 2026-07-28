import type { OperationState } from "./types";

/** Opções da janela de exibição de concluídos no mapa. */
export const MAP_WINDOW_OPTIONS = [1, 3, 7, 15, 30, "always"] as const;
export type MapWindow = (typeof MAP_WINDOW_OPTIONS)[number];
export const DEFAULT_MAP_WINDOW: MapWindow = 7;
export const MAP_WINDOW_SETTING_KEY = "map_completed_window_days";

export function mapWindowLabel(w: MapWindow): string {
  return w === "always" ? "Sempre" : w === 1 ? "1 dia" : `${w} dias`;
}

export function parseMapWindow(v: unknown): MapWindow {
  // "always" é representação estruturada explícita (sem número mágico).
  if (v === "always") return "always";
  if (typeof v !== "number" && typeof v !== "string") return DEFAULT_MAP_WINDOW;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_MAP_WINDOW;
  return (MAP_WINDOW_OPTIONS as readonly unknown[]).includes(n)
    ? (n as MapWindow)
    : DEFAULT_MAP_WINDOW;
}

/**
 * Início do dia local (00:00 no fuso do dispositivo/operação) em ms.
 * Timestamps são gravados em UTC; a comparação é feita por DIA OPERACIONAL
 * LOCAL para não antecipar nem atrasar a remoção visual perto da meia-noite.
 */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Limite inferior (inclusivo) da janela, em ms.
 * Regra inclusiva: HOJE conta como dia 1 → janela de N dias mostra
 * concluídos de hoje e dos (N-1) dias anteriores. Com N=7, algo concluído
 * há 6 dias aparece; há 7 dias (8º dia) fica oculto.
 */
export function windowStartMs(window: MapWindow, now: number = Date.now()): number | null {
  if (window === "always") return null;
  return startOfLocalDay(now) - (window - 1) * 86_400_000;
}

/**
 * Timestamp real de conclusão da operação (regra 16):
 * pedido com recolha → conclusão da recolha; sem recolha → confirmação da entrega.
 * Retorna null quando a operação ainda não foi concluída.
 */
export function completionTimestamp(s: OperationState | null | undefined): string | null {
  if (!s) return null;
  return s.pickup_completed_at ?? s.delivered_at ?? null;
}

/**
 * Regra de visibilidade — NUNCA de retenção. Operações não concluídas
 * jamais são ocultadas por janela.
 */
export function isWithinCompletedWindow(
  s: OperationState | null | undefined,
  window: MapWindow,
  now: number = Date.now(),
): boolean {
  if (window === "always") return true;
  const ts = completionTimestamp(s);
  if (!ts) return true; // ainda em operação → segue os filtros operacionais
  const at = new Date(ts).getTime();
  if (!Number.isFinite(at)) return true; // timestamp ilegível nunca oculta
  const start = windowStartMs(window, now) as number;
  return at >= start;
}

/** Início da janela em ISO/UTC — usado para filtrar no banco. */
export function windowStartIso(window: MapWindow, now: number = Date.now()): string | null {
  const start = windowStartMs(window, now);
  return start == null ? null : new Date(start).toISOString();
}

/** Remove duplicatas mantendo o primeiro item de cada chave (prioridade do caller). */
export function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Busca histórica local: número, cliente, endereço, responsável, status, empresa. */
export function matchesHistorySearch(
  s: OperationState,
  term: string,
  extra?: { assigneeName?: string | null; statusLabel?: string | null },
): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  const hay = [
    String(s.erp_order_number ?? ""),
    String(s.erp_order_id ?? ""),
    String(s.company_id ?? ""),
    typeof snap.customerName === "string" ? snap.customerName : "",
    typeof snap.address === "string" ? snap.address : "",
    typeof snap.phone === "string" ? snap.phone : "",
    s.operation_date ?? "",
    s.operational_date ?? "",
    s.delivered_at ?? "",
    extra?.assigneeName ?? "",
    extra?.statusLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
