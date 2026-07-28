"use strict";

/**
 * Acesso a dados de TIPO_EQUIPAMENTO — SOMENTE LEITURA.
 *
 * Igual ao módulo de produtos: nenhum valor do usuário entra em SQL; os
 * únicos trechos dinâmicos são nomes de coluna confirmados pela introspecção.
 */

const firebird = require("../../shared/database/firebird-client");
const introspection = require("../../shared/database/schema-introspection");
const { AppError } = require("../../shared/errors/app-error");

const TABLE = "TIPO_EQUIPAMENTO";

const COLUMN_CANDIDATES = Object.freeze({
  id: ["ID_TIPO_EQUIPAMENTO", "ID_TIPO_EQUIP", "ID_TIPO"],
  description: ["DESCRICAO", "NOME"],
  code: ["CODIGO", "SIGLA"],
  companyId: ["ID_EMPRESA"],
  deleted: ["DELETED"],
  active: ["ATIVO", "SITUACAO", "INATIVO"],
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
      return { type: out };
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
  if (!schema.type.id) {
    throw new AppError({
      message: "Catálogo de tipos de equipamento indisponível neste ERP.",
      statusCode: 500,
      code: "EQUIPMENT_TYPE_QUERY_FAILED",
      retryable: false,
    });
  }
}

function buildSelectList(schema) {
  const t = schema.type;
  return [
    `te.${t.id} AS ID_TIPO_EQUIPAMENTO`,
    t.description ? `te.${t.description} AS TIPO_DESCRICAO` : null,
    t.code ? `te.${t.code} AS TIPO_CODIGO` : null,
    t.companyId ? `te.${t.companyId} AS TIPO_ID_EMPRESA` : null,
    t.active ? `te.${t.active} AS TIPO_ATIVO` : null,
    t.deleted ? `te.${t.deleted} AS TIPO_DELETED` : null,
  ]
    .filter(Boolean)
    .join(",\n      ");
}

/**
 * Catálogo pequeno e estável: listagem completa com teto rígido de linhas.
 * @param {{qPatterns?: string[]|null, limit: number}} input
 */
async function listEquipmentTypes(input) {
  const schema = await getSchema();
  assertSupported(schema);
  const t = schema.type;

  const where = ["1 = 1"];
  const params = [];

  if (t.deleted) where.push(`(te.${t.deleted} IS NULL OR te.${t.deleted} = 0)`);

  if (input.qPatterns && input.qPatterns.length > 0 && t.description) {
    const ors = [];
    for (const pattern of input.qPatterns) {
      ors.push(`UPPER(te.${t.description}) LIKE ?`);
      params.push(pattern);
    }
    where.push(`(${ors.join(" OR ")})`);
  }

  const sql = `
    SELECT
      ${buildSelectList(schema)}
    FROM ${TABLE} te
    WHERE ${where.join("\n      AND ")}
    ORDER BY te.${t.id} ASC
    ROWS ?
  `;
  params.push(input.limit);

  const rows = (await firebird.executeQuery(sql, params)) || [];
  return { rows, schema };
}

module.exports = { TABLE, COLUMN_CANDIDATES, getSchema, resetSchemaCache, listEquipmentTypes };