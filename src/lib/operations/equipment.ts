/**
 * Decisão única: um pedido precisa de recolhimento **somente** quando
 * contém equipamento realmente retornável — chopeira ou cilindro de CO₂.
 *
 * NÃO geram recolhimento (o cliente fica com o produto ou devolução é
 * tratada de outra forma):
 *   - Barril (30L, 50L, chopp, etc.)
 *   - Growler
 *   - Produtos e bebidas
 *
 * Toda a aplicação deve consultar apenas `hasPickupRequiredEquipment`.
 */
export interface EquipmentLike {
  quantity?: number | null;
  type?: string | null;
}
export interface OrderLike {
  equipments?: EquipmentLike[] | null;
}

// Whitelist de tipos que exigem recolhimento. Regex sem acento — a
// comparação normaliza o nome do tipo antes de casar.
const PICKUP_TYPE_REGEX = /(chopeir|cilindr|\bco2\b)/i;

function normalizeType(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Verdadeiro se o tipo do equipamento exige recolhimento. */
export function isPickupRequiredType(type: string | null | undefined): boolean {
  if (!type) return false;
  return PICKUP_TYPE_REGEX.test(normalizeType(type));
}

export function hasPickupRequiredEquipment(
  order: OrderLike | null | undefined,
): boolean {
  const list = order?.equipments;
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((e) => {
    if (!isPickupRequiredType(e?.type ?? null)) return false;
    const q = typeof e?.quantity === "number" ? e.quantity : Number(e?.quantity ?? 0);
    if (!Number.isFinite(q)) return true;
    return q > 0;
  });
}

/** @deprecated — use `hasPickupRequiredEquipment`. Mantido como alias. */
export const hasReturnableEquipment = hasPickupRequiredEquipment;
export const needsPickup = hasPickupRequiredEquipment;