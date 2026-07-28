"use strict";

/**
 * Acesso a dados de PRODUTOS — SOMENTE LEITURA.
 *
 * Nenhuma entrada do usuário é interpolada em SQL. Os únicos trechos
 * dinâmicos são NOMES DE COLUNA confirmados pela introspecção do catálogo do
 * próprio Firebird (RDB$RELATION_FIELDS) e validados como identificadores.
 * Todo valor trafega parametrizado.
 */

const firebird = require("../../shared/database/firebird-client");
const introspection = require("../../shared/database/schema-introspection");

/** Candidatos por conceito — a PRIMEIRA coluna existente vence. */
const PRODUCT_COLUMN_CANDIDATES = Object.freeze({
  id: ["ID_PRODUTOS", "ID_PRODUTO"],
  description: ["DESCRICAO", "NOME"],
  code: ["CODIGO", "COD_PRODUTO", "REFERENCIA"],
  barcode: ["CODIGO_BARRA", "COD_BARRA", "EAN"],
  groupId: ["ID_GRUPO_PRODUTO", "ID_GRUPO"],
  unitId: ["ID_UNIDADE", "ID_UN"],
  companyId: ["ID_EMPRESA"],
  deleted: ["DELETED"],
  active: ["ATIVO", "SITUACAO", "INATIVO"],
  blocked: ["BLOQUEADO", "BLOQUEADO_VENDA"],
  discontinued: ["DESCONTINUADO"],
});

let schemaPromise = null;

async function resolveMap(table, candidates) {
  const out = {};
  for (const [key, list] of Object.entries(candidates)) {
    // eslint-disable-next-line no-await-in-loop
    out[key] = await introspection.pickExistingColumn(table, list);
  }
  return out;
}

/**
 * Descobre uma única vez por processo quais colunas existem de fato.
 * @returns {Promise<{product: object, unit: object, group: object}>}
 */
async function getSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [product, unitId, unitCode, unitDescription, groupId, groupDescription] =
        await Promise.all([
          resolveMap("PRODUTOS", PRODUCT_COLUMN_CANDIDATES),
          introspection.pickExistingColumn("UNIDADE", ["ID_UNIDADE"]),
          introspection.pickExistingColumn("UNIDADE", ["SIGLA", "CODIGO", "UNIDADE"]),
          introspection.pickExistingColumn("UNIDADE", ["DESCRICAO", "NOME"]),
          introspection.pickExistingColumn("GRUPO_PRODUTO", ["ID_GRUPO_PRODUTO", "ID_GRUPO"]),
          introspection.pickExistingColumn("GRUPO_PRODUTO", ["DESCRICAO", "NOME"]),
        ]);
      return {
        product,
        unit: { id: unitId, code: unitCode, description: unitDescription },
        group: { id: groupId, description: groupDescription },
      };
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

function selectIfPresent(alias, column, outAlias) {
  if (!column) return null;
  return `${alias}.${column} AS ${outAlias}`;
}

function hasUnitJoin(schema) {
  return Boolean(schema.product.unitId && schema.unit.id && (schema.unit.code || schema.unit.description));
}

function hasGroupJoin(schema) {
  return Boolean(schema.product.groupId && schema.group.id && schema.group.description);
}

/** Projeção explícita — nunca SELECT *. */
function buildSelectList(schema) {
  const p = schema.product;
  return [
    `pr.${p.id} AS ID_PRODUTO`,
    selectIfPresent("pr", p.description, "PRODUTO_DESCRICAO"),
    selectIfPresent("pr", p.code, "PRODUTO_CODIGO"),
    selectIfPresent("pr", p.barcode, "PRODUTO_CODIGO_BARRA"),
    selectIfPresent("pr", p.groupId, "ID_GRUPO_PRODUTO"),
    selectIfPresent("pr", p.unitId, "ID_UNIDADE"),
    selectIfPresent("pr", p.companyId, "PRODUTO_ID_EMPRESA"),
    selectIfPresent("pr", p.deleted, "PRODUTO_DELETED"),
    selectIfPresent("pr", p.active, "PRODUTO_ATIVO"),
    selectIfPresent("pr", p.blocked, "PRODUTO_BLOQUEADO"),
    selectIfPresent("pr", p.discontinued, "PRODUTO_DESCONTINUADO"),
    hasUnitJoin(schema) && schema.unit.code ? `un.${schema.unit.code} AS UNIDADE_CODIGO` : null,
    hasUnitJoin(schema) && schema.unit.description
      ? `un.${schema.unit.description} AS UNIDADE_DESCRICAO`
      : null,
    hasGroupJoin(schema) ? `gp.${schema.group.description} AS GRUPO_DESCRICAO` : null,
  ]
    .filter(Boolean)
    .join(",\n      ");
}

function buildJoins(schema) {
  const joins = [];
  if (hasUnitJoin(schema)) {
    joins.push(`LEFT JOIN UNIDADE un ON pr.${schema.product.unitId} = un.${schema.unit.id}`);
  }
  if (hasGroupJoin(schema)) {
    joins.push(`LEFT JOIN GRUPO_PRODUTO gp ON pr.${schema.product.groupId} = gp.${schema.group.id}`);
  }
  return joins.join("\n    ");
}

function assertSupported(schema) {
  if (!schema.product.id) {
    const { AppError } = require("../../shared/errors/app-error");
    throw new AppError({
      message: "Catálogo de produtos indisponível neste ERP.",
      statusCode: 500,
      code: "PRODUCT_QUERY_FAILED",
      retryable: false,
    });
  }
}

/**
 * Busca paginada por keyset (ID do produto ASC) com teto rígido de linhas.
 *
 * @param {{qPatterns?: string[]|null, qRaw?: string|null, productId?: number|null,
 *          groupId?: number|null, unitId?: number|null, code?: string|null,
 *          companyId?: number|null, limit: number, cursor: number|null}} input
 */
async function searchProducts(input) {
  const schema = await getSchema();
  assertSupported(schema);
  const p = schema.product;

  const where = ["1 = 1"];
  const params = [];

  if (p.deleted) where.push(`(pr.${p.deleted} IS NULL OR pr.${p.deleted} = 0)`);

  if (input.cursor !== null && input.cursor !== undefined) {
    where.push(`pr.${p.id} > ?`);
    params.push(input.cursor);
  }

  if (input.productId) {
    where.push(`pr.${p.id} = ?`);
    params.push(input.productId);
  }

  if (input.qPatterns && input.qPatterns.length > 0) {
    const ors = [];
    for (const pattern of input.qPatterns) {
      if (p.description) {
        ors.push(`UPPER(pr.${p.description}) LIKE ?`);
        params.push(pattern);
      }
      if (p.code) {
        ors.push(`UPPER(pr.${p.code}) LIKE ?`);
        params.push(pattern);
      }
    }
    if (/^\d+$/.test(input.qRaw || "")) {
      ors.push(`pr.${p.id} = ?`);
      params.push(Number(input.qRaw));
    }
    if (ors.length === 0) return { rows: [], schema };
    where.push(`(${ors.join(" OR ")})`);
  }

  if (input.code) {
    if (!p.code) return { rows: [], schema };
    where.push(`UPPER(pr.${p.code}) = ?`);
    params.push(String(input.code).toUpperCase());
  }

  if (input.groupId !== null && input.groupId !== undefined) {
    if (!p.groupId) return { rows: [], schema };
    where.push(`pr.${p.groupId} = ?`);
    params.push(input.groupId);
  }

  if (input.unitId !== null && input.unitId !== undefined) {
    if (!p.unitId) return { rows: [], schema };
    where.push(`pr.${p.unitId} = ?`);
    params.push(input.unitId);
  }

  if (input.companyId !== null && input.companyId !== undefined && p.companyId) {
    where.push(`pr.${p.companyId} = ?`);
    params.push(input.companyId);
  }

  const sql = `
    SELECT
      ${buildSelectList(schema)}
    FROM PRODUTOS pr
    ${buildJoins(schema)}
    WHERE ${where.join("\n      AND ")}
    ORDER BY pr.${p.id} ASC
    ROWS ?
  `;
  params.push(input.limit);

  const rows = (await firebird.executeQuery(sql, params)) || [];
  return { rows, schema };
}

async function findProductById(productId) {
  const schema = await getSchema();
  assertSupported(schema);
  const sql = `
    SELECT
      ${buildSelectList(schema)}
    FROM PRODUTOS pr
    ${buildJoins(schema)}
    WHERE pr.${schema.product.id} = ?
    ROWS 1
  `;
  const rows = (await firebird.executeQuery(sql, [productId])) || [];
  return { row: rows[0] || null, schema };
}

module.exports = {
  PRODUCT_COLUMN_CANDIDATES,
  getSchema,
  resetSchemaCache,
  searchProducts,
  findProductById,
  _internal: { buildSelectList, buildJoins, selectIfPresent },
};