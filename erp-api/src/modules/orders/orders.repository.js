"use strict";

const firebird = require("../../shared/database/firebird-client");

/**
 * Camada de acesso a dados para criação de pedidos.
 *
 * Todas as operações rodam dentro de UMA MESMA transação (`tx`) — o caller
 * (service) é responsável por abrir/commitar/roll-backar. Nenhum COMMIT
 * intermediário é feito aqui.
 *
 * Chamadas de stored procedures usam a forma:
 *   SELECT <out_cols> FROM <PROC>(?, ?, ...)
 * — que é a maneira suportada pelo node-firebird para executar procedures
 * selecionáveis e capturar parâmetros OUT.
 */

const SP_CAD_ORDEM_VENDA_COMPLETO_SQL = `
  SELECT ID FROM SP_CAD_ORDEM_VENDA_COMPLETO(
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`;

const SP_CAD_ITENS_ORDENS_VENDA_SQL = `
  SELECT ID FROM SP_CAD_ITENS_ORDENS_VENDA(?, ?, ?, ?, ?, ?)
`;

const SP_CAD_EQUIP_ORDENS_VENDA_SQL = `
  EXECUTE PROCEDURE SP_CAD_EQUIP_ORDENS_VENDA(?, ?, ?, ?, ?)
`;

const SELECT_CREATED_ORDER_SQL = `
  SELECT
    ov.ID_ORDENS_VENDA,
    ov.N_PEDIDO,
    ov.ID_EMPRESA,
    s.DESCRICAO AS STATUS_DESCRICAO
  FROM ORDENS_VENDA ov
  LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
  WHERE ov.ID_ORDENS_VENDA = ?
`;

const UPDATE_ORDER_STATUS_SQL = `
  UPDATE ORDENS_VENDA
  SET ID_STATUS = 27
  WHERE ID_ORDENS_VENDA = ?
`;


async function callCreateOrderComplete(tx, params) {
  const rows = await tx.query(SP_CAD_ORDEM_VENDA_COMPLETO_SQL, params);
  const row = rows && rows[0];
  if (!row) {
    const err = new Error("procedure_no_return");
    err.code = "PROCEDURE_NO_RETURN";
    throw err;
  }
  const id = row.ID !== undefined ? row.ID : row.id;
  const numeric = Number(id);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const err = new Error("procedure_invalid_id");
    err.code = "PROCEDURE_INVALID_ID";
    throw err;
  }
  return numeric;
}

async function callAddItem(tx, params) {
  await tx.query(SP_CAD_ITENS_ORDENS_VENDA_SQL, params);
}

async function callAddEquipment(tx, params) {
  await tx.query(SP_CAD_EQUIP_ORDENS_VENDA_SQL, params);
}

async function updateStatusToPending(tx, orderId) {
  await tx.query(UPDATE_ORDER_STATUS_SQL, [orderId]);
}


async function fetchCreatedOrder(tx, orderId) {
  const rows = await tx.query(SELECT_CREATED_ORDER_SQL, [orderId]);
  return rows && rows[0] ? rows[0] : null;
}

async function fetchClientCompanyContext(tx, clientId) {
  const rows = await tx.query(
    `
      SELECT
        cl.ID_EMPRESA AS CLIENTE_ID_EMPRESA,
        gc.DESCRICAO  AS GRUPO_DESCRICAO
      FROM CLIENTES cl
      LEFT JOIN GRUPO_CLIENTE gc ON cl.ID_GRUPO_CLIENTE = gc.ID_GRUPO_CLIENTE
      WHERE cl.ID_CLIENTE = ?
    `,
    [clientId],
  );
  return rows && rows[0] ? rows[0] : null;
}

async function fetchOrderById(tx, orderId) {
  const sql = `
    SELECT 
      ov.*, 
      s.DESCRICAO AS STATUS_DESCRICAO
    FROM ORDENS_VENDA ov
    LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
    WHERE ov.ID_ORDENS_VENDA = ?
  `;
  const rows = await tx.query(sql, [orderId]);
  return rows && rows[0] ? rows[0] : null;
}

async function findStatusByNumbers(orderNumbers) {
  if (!orderNumbers || orderNumbers.length === 0) return [];
  const placeholders = orderNumbers.map(() => "?").join(", ");
  const sql = `
    SELECT 
      ov.ID_ORDENS_VENDA, 
      ov.N_PEDIDO,
      ov.ID_STATUS, 
      s.DESCRICAO AS STATUS_DESCRICAO
    FROM ORDENS_VENDA ov
    LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
    WHERE ov.N_PEDIDO IN (${placeholders})
  `;
  return firebird.executeQuery(sql, orderNumbers);
}

async function fetchOrderByNumber(txOrConn, orderNumber) {
  // 1. Log Seguro de Entrada
  logger.info({ orderNumber }, "[ORDER DETAIL DEBUG] Início da busca");

  // 2. SQL Mínima para Garantir Existência
  const sqlMin = "SELECT ID_ORDENS_VENDA, N_PEDIDO, ID_CLIENTE, ID_EMPRESA, ID_STATUS FROM ORDENS_VENDA WHERE N_PEDIDO = ?";
  
  let resultMin;
  if (txOrConn && typeof txOrConn.query === "function") {
    resultMin = await txOrConn.query(sqlMin, [orderNumber]);
  } else {
    resultMin = await firebird.executeQuery(sqlMin, [orderNumber]);
  }

  // Debug do formato do retorno
  logger.info({
    orderNumber,
    type: typeof resultMin,
    isArray: Array.isArray(resultMin),
    count: Array.isArray(resultMin) ? resultMin.length : (resultMin ? 1 : 0),
    keys: resultMin && !Array.isArray(resultMin) ? Object.keys(resultMin) : []
  }, "[ORDER DETAIL DEBUG] Formato retorno executeQuery");

  const rowsMin = Array.isArray(resultMin) ? resultMin : (resultMin ? [resultMin] : []);
  if (rowsMin.length === 0) {
    logger.warn({ orderNumber }, "[ORDER DETAIL DEBUG] Pedido não encontrado na SELECT mínima");
    return null;
  }

  // 3. SQL Detalhada com LEFT JOINs para evitar 404 por dados opcionais
  const sql = `
    SELECT 
      ov.*, 
      s.DESCRICAO AS STATUS_DESCRICAO,
      cl.NM_CLIENTE AS CLIENTE_NOME,
      v.NM_VENDEDOR AS VENDEDOR_NOME
    FROM ORDENS_VENDA ov
    LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
    LEFT JOIN CLIENTES cl ON ov.ID_CLIENTE = cl.ID_CLIENTE
    LEFT JOIN VENDEDORES v ON ov.ID_VENDEDOR = v.ID_VENDEDOR
    WHERE ov.N_PEDIDO = ?
  `;
  
  let rows;
  if (txOrConn && typeof txOrConn.query === "function") {
    rows = await txOrConn.query(sql, [orderNumber]);
  } else {
    rows = await firebird.executeQuery(sql, [orderNumber]);
  }
  
  const result = Array.isArray(rows) ? rows[0] : rows;

  if (!result) {
    logger.error({ orderNumber }, "[ORDER DETAIL DEBUG] Pedido sumiu na SELECT detalhada! Checar JOINs");
    // Se a mínima existia mas a completa falhou, retornamos o básico da mínima pelo menos
    return rowsMin[0];
  }

  return result;
}

async function fetchItemsByOrderId(orderId) {
  const sql = `SELECT * FROM ITENS_ORDENS_VENDA WHERE ID_ORDENS_VENDA = ?`;
  return firebird.executeQuery(sql, [orderId]);
}

async function fetchEquipmentsByOrderId(orderId) {
  const sql = `SELECT * FROM EQUIP_ORDENS_VENDA WHERE ID_ORDENS_VENDA = ?`;
  return firebird.executeQuery(sql, [orderId]);
}

async function deleteItemsByOrderId(tx, orderId) {
  await tx.query(`DELETE FROM ITENS_ORDENS_VENDA WHERE ID_ORDENS_VENDA = ?`, [orderId]);
}

async function deleteEquipmentsByOrderId(tx, orderId) {
  await tx.query(`DELETE FROM EQUIP_ORDENS_VENDA WHERE ID_ORDENS_VENDA = ?`, [orderId]);
}

module.exports = {
  callCreateOrderComplete,
  callAddItem,
  callAddEquipment,
  updateStatusToPending,
  fetchCreatedOrder,

  fetchOrderById,
  fetchOrderByNumber,
  findStatusByNumbers,
  fetchClientCompanyContext,
  fetchItemsByOrderId,
  fetchEquipmentsByOrderId,
  deleteItemsByOrderId,
  deleteEquipmentsByOrderId,
  _sql: {
    SP_CAD_ORDEM_VENDA_COMPLETO_SQL,
    SP_CAD_ITENS_ORDENS_VENDA_SQL,
    SP_CAD_EQUIP_ORDENS_VENDA_SQL,
    SELECT_CREATED_ORDER_SQL,
  },
};