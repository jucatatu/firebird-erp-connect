import { OrderDraftRow } from "@/hooks/use-drafts";

/**
 * Resumo de produtos: Chopp Pilsen 30L, American IPA 10L...
 */
export function getItemsSummary(payload: any, limit: number = 2): string {
  const items = payload?.items || [];
  if (items.length === 0) return "Nenhum produto";
  
  const summary = items.slice(0, limit).map((i: any) => {
    const desc = i.description || `Produto ${i.productId}`;
    const isChopp = desc.toUpperCase().includes("CHOPP") || i.unit === "L";
    const unit = isChopp ? "L" : "x";
    return `${desc} ${i.quantity}${unit}`;
  }).join(", ");
  
  if (items.length > limit) {
    return `${summary} +${items.length - limit} itens`;
  }
  return summary;
}

/**
 * Resumo de equipamentos: Barril 30L 1x, Chopeira 2 vias 1x...
 */
export function getEquipmentsSummary(payload: any, limit: number = 2): string {
  const equipments = payload?.equipments || payload?.equipment || [];
  if (equipments.length === 0) return "Nenhum";
  
  const summary = equipments.slice(0, limit).map((e: any) => {
    const desc = e.description || `Equip. ${e.equipmentTypeId}`;
    return `${desc} ${e.quantity}x`;
  }).join(", ");
  
  if (equipments.length > limit) {
    return `${summary} +${equipments.length - limit} equipamentos`;
  }
  return summary;
}
