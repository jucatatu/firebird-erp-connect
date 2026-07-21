"use strict";

const firebird = require("../../shared/database/firebird-client");

/**
 * Camada de acesso a dados do módulo Operations.
 *
 * IMPORTANTE — SCHEMA PENDENTE DE CONFIRMAÇÃO NO SERVIDOR WINDOWS:
 * Os nomes de colunas abaixo refletem o padrão observado nas consultas
 * conhecidas do ERP, mas ainda NÃO foram validados contra o dicionário
 * real do Firebird em produção. Qualquer campo cuja existência não seja
 * confirmada está marcado com "TODO(schema)" abaixo.
 *
 * Todas as consultas são SOMENTE LEITURA e 100% parametrizadas. Nenhum
 * valor recebido do cliente é concatenado em SQL. A quantidade de
 * placeholders para listas (IN (?, ?, ...)) é gerada a partir do
 * comprimento de arrays já validados internamente.
 */

const MAX_PARAMS_PER_QUERY = 500;

function buildInPlaceholders(n) {
  return Array.from({ length: n }, () => "?").join(", ");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function findOrdersByDeliveryDate(date) {
  const sql = `
    SELECT
      OV.ID              AS ORDER_ID,
      OV.NUMERO          AS ORDER_NUMERO,
      OV.ID_EMPRESA      AS ORDER_ID_EMPRESA,
      OV.ID_STATUS       AS ORDER_ID_STATUS,
      OV.DT_ENTREGA      AS ORDER_DT_ENTREGA,
      OV.OBSERVACAO      AS ORDER_OBSERVACAO,
      OV.ID_CLIENTE      AS ORDER_ID_CLIENTE,
      S.NOME             AS STATUS_NOME,
      C.ID               AS CLIENTE_ID,
      C.NOME_FANTASIA    AS CLIENTE_NOME_FANTASIA,
      C.ID_GRUPO_CLIENTE AS CLIENTE_ID_GRUPO,
      C.ID_PESSOA        AS CLIENTE_ID_PESSOA,
      P.NOME             AS PESSOA_NOME,
      C.ENDERECO         AS CLI_ENDERECO,
      C.NUMERO           AS CLI_NUMERO_END,
      C.COMPLEMENTO      AS CLI_COMPLEMENTO,
      B.NOME             AS BAIRRO_NOME,
      CID.NOME           AS CIDADE_NOME,
      EST.UF             AS ESTADO_UF,
      C.CEP              AS CLI_CEP,
      C.REFERENCIA       AS CLI_REFERENCIA,
      C.TELEFONE         AS CLI_TELEFONE
    FROM ORDENS_VENDA OV
    LEFT JOIN STATUS   S   ON S.ID   = OV.ID_STATUS
    LEFT JOIN CLIENTES C   ON C.ID   = OV.ID_CLIENTE
    LEFT JOIN PESSOAS  P   ON P.ID   = C.ID_PESSOA
    LEFT JOIN BAIRRO   B   ON B.ID   = C.ID_BAIRRO
    LEFT JOIN CIDADE   CID ON CID.ID = C.ID_CIDADE
    LEFT JOIN ESTADO   EST ON EST.ID = C.ID_ESTADO
    WHERE OV.ENTREGAR = 1
      AND OV.DT_ENTREGA = ?
    ORDER BY OV.DT_ENTREGA, OV.NUMERO
  `;
  return firebird.executeQuery(sql, [date]);
}

async function findItemsByOrderIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return [];
  const batches = chunk(orderIds, MAX_PARAMS_PER_QUERY);
  const results = [];
  for (const ids of batches) {
    const placeholders = buildInPlaceholders(ids.length);
    const sql = `
      SELECT
        IOV.ID_ORDEM_VENDA AS ORDER_ID,
        IOV.ID             AS ITEM_ID,
        IOV.ID_PRODUTO     AS PRODUTO_ID,
        IOV.QUANTIDADE     AS QUANTIDADE,
        IOV.UNIDADE        AS UNIDADE,
        PR.NOME            AS PRODUTO_NOME
      FROM ITENS_ORDENS_VENDA IOV
      LEFT JOIN PRODUTOS PR ON PR.ID = IOV.ID_PRODUTO
      WHERE IOV.ID_ORDEM_VENDA IN (${placeholders})
      ORDER BY IOV.ID_ORDEM_VENDA, IOV.ID
    `;
    const rows = await firebird.executeQuery(sql, ids);
    results.push(...rows);
  }
  return results;
}

async function findEquipmentByOrderIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return [];
  const batches = chunk(orderIds, MAX_PARAMS_PER_QUERY);
  const results = [];
  for (const ids of batches) {
    const placeholders = buildInPlaceholders(ids.length);
    const sql = `
      SELECT
        EOV.ID_ORDEM_VENDA   AS ORDER_ID,
        EOV.ID               AS EQUIP_ID,
        EOV.ID_TIPO_EQUIP    AS TIPO_ID,
        EOV.QUANTIDADE       AS QUANTIDADE,
        TE.NOME              AS TIPO_NOME
      FROM EQUIP_ORDENS_VENDA EOV
      LEFT JOIN TIPO_EQUIPAMENTO TE ON TE.ID = EOV.ID_TIPO_EQUIP
      WHERE EOV.ID_ORDEM_VENDA IN (${placeholders})
      ORDER BY EOV.ID_ORDEM_VENDA, EOV.ID
    `;
    const rows = await firebird.executeQuery(sql, ids);
    results.push(...rows);
  }
  return results;
}

module.exports = {
  findOrdersByDeliveryDate,
  findItemsByOrderIds,
  findEquipmentByOrderIds,
  _internal: { buildInPlaceholders, chunk, MAX_PARAMS_PER_QUERY },
};