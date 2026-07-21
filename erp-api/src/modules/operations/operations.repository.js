"use strict";

const firebird = require("../../shared/database/firebird-client");

/**
 * Camada de acesso a dados do módulo Operations (schema real do ERP).
 *
 * Todas as consultas são SOMENTE LEITURA e 100% parametrizadas.
 * Placeholders `?` para cláusulas IN são gerados a partir do comprimento
 * de arrays internos — nenhuma entrada do cliente é interpolada em SQL.
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

/**
 * Busca pedidos com previsão de entrega na data informada.
 * @param {string} firebirdDate — já convertida para MM/DD/YYYY pelo service.
 */
async function findOrdersByDeliveryDate(firebirdDate) {
  const sql = `
    SELECT
      ov.N_PEDIDO,
      ov.ID_ORDENS_VENDA,
      ov.ID_CLIENTE,
      ov.DATA_PREV_RETORNO,
      ov.DATA_PREV_ENTREGA,
      ov.OBS,
      ov.NUMERO,
      ov.COMPLEMENTO,

      ov.ID_EMPRESA AS ORDEM_ID_EMPRESA,
      cl.ID_EMPRESA AS CLIENTE_ID_EMPRESA,
      gc.DESCRICAO  AS GRUPO_CLIENTE_DESCRICAO,

      p.NOME AS CLIENTE_NOME,
      p.APELIDO AS CLIENTE_APELIDO,

      e.SIGLA AS UF,
      ci.NOME AS CIDADE,
      b.NOME AS BAIRRO,
      r.NOME AS RUA,

      s.DESCRICAO AS STATUS_DESCRICAO

    FROM ORDENS_VENDA ov
    LEFT JOIN CLIENTES cl ON ov.ID_CLIENTE = cl.ID_CLIENTE
    LEFT JOIN PESSOAS  p  ON cl.ID_PESSOA = p.ID_PESSOA
    LEFT JOIN GRUPO_CLIENTE gc ON cl.ID_GRUPO_CLIENTE = gc.ID_GRUPO_CLIENTE
    LEFT JOIN ESTADO   e  ON ov.ID_ESTADO = e.ID_ESTADO
    LEFT JOIN CIDADE   ci ON ov.ID_CIDADE = ci.ID_CIDADE
    LEFT JOIN BAIRRO   b  ON ov.ID_BAIRRO = b.ID_BAIRRO
    LEFT JOIN RUA      r  ON ov.ID_RUA = r.ID_RUA
    LEFT JOIN STATUS   s  ON ov.ID_STATUS = s.ID_STATUS
    WHERE CAST(ov.DATA_PREV_ENTREGA AS DATE) = ?
      AND ov.ENTREGAR = 1
      AND (ov.DELETED IS NULL OR ov.DELETED = 0)
    ORDER BY ov.N_PEDIDO DESC
  `;
  return firebird.executeQuery(sql, [firebirdDate]);
}

async function findItemsByOrderIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return [];
  const batches = chunk(orderIds, MAX_PARAMS_PER_QUERY);
  const results = [];
  for (const ids of batches) {
    const placeholders = buildInPlaceholders(ids.length);
    const sql = `
      SELECT
        iov.ID_ORDENS_VENDA,
        iov.ID_PRODUTO,
        pr.DESCRICAO AS PRODUTO,
        iov.QTDE_PEDIDA AS QUANTIDADE,
        iov.PRECO_UNIT AS VALOR_UNITARIO,
        iov.VALOR_ITEM AS VALOR_TOTAL
      FROM ITENS_ORDENS_VENDA iov
      JOIN PRODUTOS pr ON iov.ID_PRODUTO = pr.ID_PRODUTOS
      WHERE iov.ID_ORDENS_VENDA IN (${placeholders})
        AND (iov.DELETED IS NULL OR iov.DELETED = 0)
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
        eov.ID_ORDENS_VENDA,
        eov.ID_TIPO_EQUIPAMENTO,
        te.DESCRICAO AS TIPO,
        eov.QTDE AS QUANTIDADE
      FROM EQUIP_ORDENS_VENDA eov
      JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA IN (${placeholders})
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    const rows = await firebird.executeQuery(sql, ids);
    results.push(...rows);
  }
  return results;
}

/**
 * Busca telefones dos clientes em lote via tabela CONTATO,
 * filtrando pelos tipos CELULAR e FONE.
 * A ordenação garante que CELULAR venha antes de FONE — o service
 * escolhe apenas o primeiro telefone de cada cliente.
 */
async function findPhonesByClientIds(clientIds) {
  if (!clientIds || clientIds.length === 0) return [];
  const batches = chunk(clientIds, MAX_PARAMS_PER_QUERY);
  const results = [];
  for (const ids of batches) {
    const placeholders = buildInPlaceholders(ids.length);
    const sql = `
      SELECT
        cl.ID_CLIENTE,
        c.DESCRICAO AS TELEFONE,
        tc.DESCRICAO AS TIPO_CONTATO
      FROM CONTATO c
      JOIN TIPO_CONTATO tc ON c.ID_TIPO_CONTATO = tc.ID_TIPO_CONTATO
      JOIN CLIENTES cl ON c.ID_PESSOA = cl.ID_PESSOA
      WHERE cl.ID_CLIENTE IN (${placeholders})
        AND (c.DELETED IS NULL OR c.DELETED = 0)
        AND UPPER(tc.DESCRICAO) IN ('CELULAR', 'FONE')
      ORDER BY
        cl.ID_CLIENTE,
        CASE UPPER(tc.DESCRICAO)
          WHEN 'CELULAR' THEN 1
          WHEN 'FONE' THEN 2
          ELSE 3
        END
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
  findPhonesByClientIds,
  _internal: { buildInPlaceholders, chunk, MAX_PARAMS_PER_QUERY },
};