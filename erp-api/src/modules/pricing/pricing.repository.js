"use strict";

/**
 * Acesso a dados de PRECO — SOMENTE LEITURA.
 *
 * Igual aos módulos de produtos e tipos de equipamento: nenhum valor vindo do
 * usuário entra em SQL por concatenação. Os únicos trechos dinâmicos são
 * nomes de coluna confirmados pela introspecção do catálogo do Firebird.
 *
 * Este módulo NÃO calcula preço. Apenas lê a coluna de valor da tabela.
 */

const firebird = require("../../shared/database/firebird-client");
const introspection = require("../../shared/database/schema-introspection");
const { AppError } = require("../../shared/errors/app-error");

const TABLE = "PRECO";

const COLUMN_CANDIDATES = Object.freeze({
  id: ["ID_PRECO"],
  productId: ["ID_PRODUTO"],
  clientId: ["ID_CLIENTE"],
  groupId: ["ID_GRUPO_CLIENTE"],
  value: ["VALOR"],
  deleted: ["DELETED"],
  dateUpdate: ["DATE_UPDATE"],
});

let schemaPromise = null;

async function getSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const out = {};
      for (const [key, list] of Object.entries(COLUMN_CANDIDATES)) {
        // eslint-disable-next-line no-await-in-loop
        out[key] = await introspection.pickExistingColumn(TABLE, list);
      }
      return { price: out };
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function resetSchemaCache() {
  schemaPromise = null;
  introspection.clearCache();
}

function assertSupported(schema) {
  const p = schema.price;
  if (!p.id || !p.productId || !p.value) {
    throw new AppError({
      message: "Resolução de preços indisponível neste ERP.",
      statusCode: 500,
      code: "PRICE_QUERY_FAILED",
      retryable: false,
    });
  }
}

function buildOrderBy(p) {
  const parts = [];
  if (p.dateUpdate) parts.push(`p.${p.dateUpdate} DESC`);
  parts.push(`p.${p.id} DESC`);
  return parts.join(", ");
}

function buildSelect(p, where) {
  return `
    SELECT FIRST 1
      p.${p.id} AS ID_PRECO,
      p.${p.value} AS VALOR
    FROM ${TABLE} p
    WHERE ${where.join("\n      AND ")}
    ORDER BY ${buildOrderBy(p)}
  `;
}

/** Preço específico do cliente. */
async function findClientSpecificPrice({ productId, clientId }) {
  const schema = await getSchema();
  assertSupported(schema);
  const p = schema.price;
  if (!p.clientId) return null;

  const where = [`p.${p.productId} = ?`, `p.${p.clientId} = ?`];
  if (p.deleted) where.push(`(p.${p.deleted} IS NULL OR p.${p.deleted} = 0)`);

  const rows =
    (await firebird.executeQuery(buildSelect(p, where), [productId, clientId])) || [];
  return rows[0] || null;
}

/** Preço padrão do produto: sem cliente e sem grupo de cliente. */
async function findDefaultPrice({ productId }) {
  const schema = await getSchema();
  assertSupported(schema);
  const p = schema.price;

  const where = [`p.${p.productId} = ?`];
  if (p.clientId) where.push(`p.${p.clientId} IS NULL`);
  if (p.groupId) where.push(`p.${p.groupId} IS NULL`);
  if (p.deleted) where.push(`(p.${p.deleted} IS NULL OR p.${p.deleted} = 0)`);

  const rows = (await firebird.executeQuery(buildSelect(p, where), [productId])) || [];
  return rows[0] || null;
}

module.exports = {
  TABLE,
  COLUMN_CANDIDATES,
  getSchema,
  resetSchemaCache,
  findClientSpecificPrice,
  findDefaultPrice,
};