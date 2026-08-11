"use strict";

const firebird = require("../../shared/database/firebird-client");
const { logger } = require("../../config/logger");

/**
 * Camada de acesso a dados para criação de pedidos.
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

/**
 * Busca detalhe do pedido pelo número (N_PEDIDO).
 * Padronizado: (orderNumber, txOrConn = null)
 */
async function fetchOrderByNumber(orderNumber, txOrConn = null) {
  const sql = `
    SELECT
        ov.*,
        s.DESCRICAO AS STATUS_DESCRICAO
    FROM ORDENS_VENDA ov
    LEFT JOIN STATUS s
        ON s.ID_STATUS = ov.ID_STATUS
    WHERE ov.N_PEDIDO = ?
  `;
  
  let rows;
  if (txOrConn && typeof txOrConn.query === "function") {
    rows = await txOrConn.query(sql, [orderNumber]);
  } else {
    rows = await firebird.executeQuery(sql, [orderNumber]);
  }

  const result = Array.isArray(rows) ? rows[0] : rows;
  return result || null;
}

/**
 * Busca itens do pedido com descrição do produto.
 */
async function fetchItemsByOrderId(orderId) {
  const sql = `
    SELECT
        iov.ID_PRODUTO,
        pr.DESCRICAO,
        iov.QTDE_PEDIDA,
        iov.PRECO_UNIT
    FROM ITENS_ORDENS_VENDA iov
    LEFT JOIN PRODUTOS pr
        ON iov.ID_PRODUTO = pr.ID_PRODUTOS
    WHERE iov.ID_ORDENS_VENDA = ?
      AND (iov.DELETED IS NULL OR iov.DELETED = 0)
  `;
  return firebird.executeQuery(sql, [orderId]);
}

/**
 * Busca equipamentos do pedido com descrição do tipo.
 */
async function fetchEquipmentsByOrderId(orderId) {
  const sql = `
    SELECT
        eov.ID_TIPO_EQUIPAMENTO,
        te.DESCRICAO,
        eov.QTDE
    FROM EQUIP_ORDENS_VENDA eov
    LEFT JOIN TIPO_EQUIPAMENTO te
        ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
    WHERE eov.ID_ORDENS_VENDA = ?
      AND (eov.DELETED IS NULL OR eov.DELETED = 0)
  `;
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
