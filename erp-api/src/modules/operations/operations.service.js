"use strict";

const repository = require("./operations.repository");
const mapper = require("./operations.mapper");

/**
 * Converte "YYYY-MM-DD" (contrato externo) para "MM/DD/YYYY" — o formato
 * literal esperado pela query CAST(... AS DATE) neste banco Firebird.
 * Assume que a data já passou pela validação estrita do validator.
 *
 * TODO Sprint futura:
 * confirmar a origem real de ID_EMPRESA e a regra de clientes do grupo GROTT.
 */
function toFirebirdDate(date) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

/**
 * Extrai um ID nomeado de uma linha bruta, tolerante a case da chave.
 */
function readId(row, key) {
  const v = mapper.pick(row, key);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lista pedidos para entrega em uma data específica.
 *
 * Estratégia (evita N+1):
 *   1. Consulta base: pedidos por data (convertida para MM/DD/YYYY).
 *   2. Coleta os IDs de pedidos e clientes.
 *   3. Três consultas em lote em paralelo:
 *      - telefones por cliente
 *      - itens por pedido
 *      - equipamentos por pedido
 *   4. Agrupa em memória e monta o contrato final SEM deduplicar
 *      itens ou equipamentos.
 *
 * O parâmetro `companies` é validado no contrato mas NÃO é aplicado
 * como filtro nesta Sprint — a origem real de ID_EMPRESA ainda não
 * foi confirmada no ERP e nenhum pedido pode ser silenciosamente
 * classificado ou excluído por regra inventada.
 *
 * @param {{ date: string, companies: number[] }} input
 */
async function listOrdersForDelivery({ date, companies }) {
  const firebirdDate = toFirebirdDate(date);
  const orderRows = (await repository.findOrdersByDeliveryDate(firebirdDate)) || [];

  const orderIds = [];
  const clientIds = [];
  const seenOrder = new Set();
  const seenClient = new Set();
  for (const row of orderRows) {
    const oid = readId(row, "ID_ORDENS_VENDA");
    if (oid !== null && !seenOrder.has(oid)) {
      seenOrder.add(oid);
      orderIds.push(oid);
    }
    const cid = readId(row, "ID_CLIENTE");
    if (cid !== null && !seenClient.has(cid)) {
      seenClient.add(cid);
      clientIds.push(cid);
    }
  }

  const [phoneRows, itemRows, equipRows] = await Promise.all([
    repository.findPhonesByClientIds(clientIds),
    repository.findItemsByOrderIds(orderIds),
    repository.findEquipmentByOrderIds(orderIds),
  ]);

  // Primeiro telefone por cliente (SQL já ordena CELULAR antes de FONE).
  const phoneByClient = new Map();
  for (const row of phoneRows || []) {
    const cid = readId(row, "ID_CLIENTE");
    if (cid === null) continue;
    if (phoneByClient.has(cid)) continue;
    const tel = mapper.toNullableString(mapper.pick(row, "TELEFONE"));
    if (tel !== null) phoneByClient.set(cid, tel);
  }

  // Itens por pedido — preserva linhas repetidas.
  const itemsByOrder = new Map();
  for (const row of itemRows || []) {
    const oid = readId(row, "ID_ORDENS_VENDA");
    if (oid === null) continue;
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
    itemsByOrder.get(oid).push(row);
  }

  // Equipamentos por pedido — preserva linhas repetidas.
  const equipByOrder = new Map();
  for (const row of equipRows || []) {
    const oid = readId(row, "ID_ORDENS_VENDA");
    if (oid === null) continue;
    if (!equipByOrder.has(oid)) equipByOrder.set(oid, []);
    equipByOrder.get(oid).push(row);
  }

  const orders = [];
  const emittedOrders = new Set();
  for (const orderRow of orderRows) {
    const oid = readId(orderRow, "ID_ORDENS_VENDA");
    if (oid !== null) {
      if (emittedOrders.has(oid)) continue;
      emittedOrders.add(oid);
    }
    const cid = readId(orderRow, "ID_CLIENTE");
    const phone = cid !== null && phoneByClient.has(cid) ? phoneByClient.get(cid) : null;
    const dto = mapper.buildOrder(
      orderRow,
      phone,
      oid !== null ? itemsByOrder.get(oid) || [] : [],
      oid !== null ? equipByOrder.get(oid) || [] : [],
    );
    orders.push(dto);
  }

  return {
    date,
    companies,
    count: orders.length,
    orders,
  };
}

module.exports = { listOrdersForDelivery, toFirebirdDate };