"use strict";

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

async function findStatusByIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return [];
  const placeholders = orderIds.map(() => "?").join(", ");
  const sql = `
    SELECT 
      ov.ID_ORDENS_VENDA, 
      ov.ID_STATUS, 
      s.DESCRICAO AS STATUS_DESCRICAO
    FROM ORDENS_VENDA ov
    LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
    WHERE ov.ID_ORDENS_VENDA IN (${placeholders})
  `;
  return firebird.executeQuery(sql, orderIds);
}

module.exports = {
  callCreateOrderComplete,
  callAddItem,
  callAddEquipment,
  fetchCreatedOrder,
  fetchOrderById,
  findStatusByIds,
  fetchClientCompanyContext,
  _sql: {
    SP_CAD_ORDEM_VENDA_COMPLETO_SQL,
    SP_CAD_ITENS_ORDENS_VENDA_SQL,
    SP_CAD_EQUIP_ORDENS_VENDA_SQL,
    SELECT_CREATED_ORDER_SQL,
  },
};