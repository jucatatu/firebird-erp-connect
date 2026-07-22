/**
 * Regra central: um pedido precisa de recolhimento quando o Node retorna
 * pelo menos um item em `order.equipments` com quantidade > 0.
 *
 * Itens (barril/growler listados apenas em `items`) NÃO geram recolhimento.
 * Documento vivo — quando o ERP tiver flag específica por tipo de
 * equipamento, essa função é o único ponto a evoluir.
 */
export interface EquipmentLike {
  quantity?: number | null;
  type?: string | null;
}
export interface OrderLike {
  equipments?: EquipmentLike[] | null;
}

export function hasReturnableEquipment(order: OrderLike | null | undefined): boolean {
  const list = order?.equipments;
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((e) => {
    const q = typeof e?.quantity === "number" ? e.quantity : Number(e?.quantity ?? 0);
    // Sem quantidade explícita mas presente → conta.
    if (!Number.isFinite(q)) return true;
    return q > 0;
  });
}

export const needsPickup = hasReturnableEquipment;