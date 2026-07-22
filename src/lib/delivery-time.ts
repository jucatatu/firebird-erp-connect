/**
 * Extrai um horário no formato "HH:mm" (horário local) a partir dos
 * campos disponíveis no contrato atual do erp-api. O backend hoje
 * expõe apenas datas ("YYYY-MM-DD") para entrega, mas o helper aceita
 * também strings ISO com hora e strings já no formato "HH:mm[:ss]",
 * caso um endpoint futuro passe a fornecer horário.
 *
 * Nunca aplica conversão de fuso: "14:00" volta como "14:00".
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
      // Ignora a parte "00:00" que o backend emite quando não há hora real
      // no Firebird — nesse caso não temos horário confiável.
      if (h === 0 && m === 0) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return null;
}

/** Rótulo pronto para o marcador: horário se existir, senão "Sem horário". */
export function deliveryTimeLabel(value: unknown, fallback?: string | null): string {
  const t = formatDeliveryTime(value);
  if (t) return t;
  const f = typeof fallback === "string" ? fallback.trim() : "";
  if (f) return f;
  return "Sem horário";
}