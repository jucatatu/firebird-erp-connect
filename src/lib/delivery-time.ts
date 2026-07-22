/**
 * Extrai um horário no formato "HH:mm" (horário local) a partir de:
 *  - strings "HH:mm" / "HH:mm:ss"  (usadas pelo novo campo
 *    `deliveryTime` exposto pelo backend v1.4.2+);
 *  - strings ISO "YYYY-MM-DDTHH:mm[:ss][Z|±hh:mm]" — extrai a hora
 *    literal, sem conversão de fuso;
 *  - qualquer outro valor → null.
 *
 * Regras defensivas:
 *  - "14:00" volta como "14:00" (sem conversão);
 *  - "00:00" é rebaixado a null (representa ausência de horário em
 *    campos DATE puros do Firebird);
 *  - horas inválidas (>23, min >59, "Invalid Date", etc.) → null.
 */
export function formatDeliveryTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return null;

  // "HH:mm" ou "HH:mm:ss"
  const hhmm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      if (h === 0 && m === 0) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return null;
  }

  // "YYYY-MM-DDTHH:mm[:ss][Z|±hh:mm]" — extrai HH:mm literal, sem conversão.
  const iso = /^\d{4}-\d{2}-\d{2}[Tt](\d{2}):(\d{2})/.exec(raw);
  if (iso) {
    const h = Number(iso[1]);
    const m = Number(iso[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      if (h === 0 && m === 0) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Resolve o melhor horário disponível para exibição, priorizando o
 * campo `deliveryTime` (backend v1.4.2+) e caindo de volta para a
 * parte de hora de `expectedDelivery`/`deliveryDate` quando ela vier
 * como TIMESTAMP ISO. NUNCA usa `period` como horário e nunca inventa
 * "00:00". Retorna null quando não há horário confiável.
 */
export function resolveDeliveryTime(
  order: { deliveryTime?: string | null; deliveryDate?: string | null } | null | undefined,
): string | null {
  if (!order) return null;
  return (
    formatDeliveryTime(order.deliveryTime) ??
    formatDeliveryTime(order.deliveryDate)
  );
}

/**
 * Rótulo textual para telas fora do mapa (detalhe, lista, formulário).
 * O mapa NÃO deve usar este helper — lá, ausência de horário significa
 * apenas exibir o número do pedido.
 */
export function deliveryTimeLabel(value: unknown, fallback?: string | null): string {
  const t = formatDeliveryTime(value);
  if (t) return t;
  const f = typeof fallback === "string" ? fallback.trim() : "";
  if (f) return f;
  return "Sem horário";
}