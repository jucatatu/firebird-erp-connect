import { OrderDraftRow } from "@/hooks/use-drafts";
import { formatDateOnly } from "@/utils/date-utils";

/**
 * Helper para simplificar descrições de equipamentos somente para exibição.
 * Remove padrões de vazão como "30L/H", "30 L/H", "60L/H" etc.
 * Preserva o litragem do barril (ex: "BARRIL 10L").
 */
function simplifyDescription(desc: string): string {
  if (!desc) return "";
  // Remove padrões de vazão: 30L/H, 30 L/H, 60l/h etc.
  return desc.replace(/\s?\d+\s?L\/H/gi, '').trim();
}

/**
 * Retorna lista formatada de produtos para exibição em cards.
 * Formato: "10L CHOPP PILSEN"
 */
export function getItemList(payload: any, limit: number = 2): { text: string, isMain: boolean }[] {
  const items = payload?.items || [];
  if (items.length === 0) return [];
  
  const result = items.slice(0, limit).map((i: any) => {
    const desc = i.description || `Produto ${i.productId}`;
    const isChopp = desc.toUpperCase().includes("CHOPP") || i.unit === "L";
    const unit = isChopp ? "L" : "x";
    return {
      text: `${i.quantity}${unit} ${desc.toUpperCase()}`,
      isMain: true
    };
  });
  
  if (items.length > limit) {
    result.push({ text: `+${items.length - limit} ITENS`, isMain: false });
  }
  
  return result;
}

/**
 * Retorna lista formatada de equipamentos para exibição em cards.
 * Formato: "1x CHOPEIRA ELÉTRICA 1 VIA"
 */
export function getEquipmentList(payload: any, limit: number = 3): { text: string, isMain: boolean }[] {
  const equipments = payload?.equipments || payload?.equipment || [];
  if (equipments.length === 0) return [];
  
  const result = equipments.slice(0, limit).map((e: any) => {
    const desc = simplifyDescription(e.description || `EQUIP. ${e.equipmentTypeId}`);
    return {
      text: `${e.quantity}x ${desc.toUpperCase()}`,
      isMain: true
    };
  });
  
  if (equipments.length > limit) {
    result.push({ text: `+${equipments.length - limit} EQUIPAMENTOS`, isMain: false });
  }
  
  return result;
}

/**
 * Resumo de produtos legado (string concatenada)
 */
export function getItemsSummary(payload: any, limit: number = 3): string {
  const list = getItemList(payload, limit);
  if (list.length === 0) return "Nenhum produto";
  return list.map(i => i.text).join(", ");
}

/**
 * Resumo de equipamentos legado (string concatenada)
 */
export function getEquipmentsSummary(payload: any, limit: number = 3): string {
  const list = getEquipmentList(payload, limit);
  if (list.length === 0) return "Nenhum";
  return list.map(e => e.text).join(", ");
}

/**
 * Resumo logístico compacto
 */
export function getLogisticsSummary(payload: any): string {
  const isDelivery = payload?.deliver === true;
  const date = payload?.deliveryAt;
  const typeLabel = isDelivery ? "Entrega" : "Retirada";
  const icon = isDelivery ? "🚚" : "📦";
  
  if (!date) return `${icon} ${typeLabel}`;
  return `${icon} ${typeLabel} • ${formatDateOnly(date)}`;
}
