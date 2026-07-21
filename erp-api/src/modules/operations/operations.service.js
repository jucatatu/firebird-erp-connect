"use strict";

const repository = require("./operations.repository");
const mapper = require("./operations.mapper");

/**
 * Lista pedidos para entrega em uma data específica, restringindo o
 * resultado às empresas autorizadas informadas.
 *
 * Estratégia (evita N+1):
 *   1. Consulta base: pedidos por data.
 *   2. Coleta os IDs dos pedidos.
 *   3. Uma consulta em lote para itens e outra para equipamentos.
 *   4. Agrupa em memória e monta o contrato final.
 *   5. Aplica filtro final por empresas autorizadas — pedidos fora
 *      da allowlist NUNCA aparecem na resposta.
 *
 * @param {{ date: string, empresas: number[] }} input
 */
async function listOrdersForDelivery({ date, empresas }) {
  const orderRows = await repository.findOrdersByDeliveryDate(date);

  // Deduplica pedidos por ID (o join com endereço pode multiplicar linhas).
  const uniqueOrders = mapper.dedupeBy(orderRows || [], (r) => {
    const id = r.ORDER_ID ?? r.order_id;
    return id !== undefined && id !== null ? `o:${id}` : null;
  });

  const orderIds = uniqueOrders
    .map((r) => Number(r.ORDER_ID ?? r.order_id))
    .filter((n) => Number.isFinite(n));

  const [itemRows, equipRows] = await Promise.all([
    repository.findItemsByOrderIds(orderIds),
    repository.findEquipmentByOrderIds(orderIds),
  ]);

  // Indexa itens/equip por order id.
  const itemsByOrder = new Map();
  for (const row of itemRows) {
    const oid = Number(row.ORDER_ID ?? row.order_id);
    if (!Number.isFinite(oid)) continue;
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
    itemsByOrder.get(oid).push(row);
  }
  const equipByOrder = new Map();
  for (const row of equipRows) {
    const oid = Number(row.ORDER_ID ?? row.order_id);
    if (!Number.isFinite(oid)) continue;
    if (!equipByOrder.has(oid)) equipByOrder.set(oid, []);
    equipByOrder.get(oid).push(row);
  }

  const allowed = new Set(empresas);
  const orders = [];
  for (const orderRow of uniqueOrders) {
    const oid = Number(orderRow.ORDER_ID ?? orderRow.order_id);
    const dto = mapper.buildOrder(
      orderRow,
      itemsByOrder.get(oid) || [],
      equipByOrder.get(oid) || [],
    );
    // Filtro final: pedido só entra se sua empresa (real ou inferida) estiver
    // na allowlist solicitada.
    if (allowed.has(dto.companyId)) {
      orders.push(dto);
    }
  }

  return {
    date,
    empresas,
    count: orders.length,
    orders,
  };
}

module.exports = { listOrdersForDelivery };