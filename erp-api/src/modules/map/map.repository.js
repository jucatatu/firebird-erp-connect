"use strict";

const firebird = require("../../shared/database/firebird-client");

const MAX_PARAMS_PER_QUERY = 500;
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function ph(n) {
  return Array.from({ length: n }, () => "?").join(", ");
}

/**
 * Busca endereços de pedidos por ID (usado pelo POST /map/geocode).
 * NÃO inclui ov.CEP porque a existência da coluna ainda não foi validada
 * (rodar scripts/inspect-firebird-column.js ORDENS_VENDA CEP). Enquanto isso
 * a geocodificação usa Rua + Bairro + Cidade + UF, suficiente para BR.
 */
async function findOrdersAddressesByIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return [];
  const batches = chunk(orderIds, MAX_PARAMS_PER_QUERY);
  const results = [];
  for (const ids of batches) {
    const sql = `
      SELECT
        ov.ID_ORDENS_VENDA,
        ov.N_PEDIDO,
        ov.ID_CLIENTE,
        ov.NUMERO,
        ov.COMPLEMENTO,
        e.SIGLA AS UF,
        ci.NOME AS CIDADE,
        b.NOME  AS BAIRRO,
        r.NOME  AS RUA
      FROM ORDENS_VENDA ov
      LEFT JOIN ESTADO e  ON ov.ID_ESTADO = e.ID_ESTADO
      LEFT JOIN CIDADE ci ON ov.ID_CIDADE = ci.ID_CIDADE
      LEFT JOIN BAIRRO b  ON ov.ID_BAIRRO = b.ID_BAIRRO
      LEFT JOIN RUA    r  ON ov.ID_RUA = r.ID_RUA
      WHERE ov.ID_ORDENS_VENDA IN (${ph(ids.length)})
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
    `;
    const rows = await firebird.executeQuery(sql, ids);
    results.push(...rows);
  }
  return results;
}

module.exports = { findOrdersAddressesByIds };
