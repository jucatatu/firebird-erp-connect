"use strict";

const {
  pick,
  toNullableInt,
  toNullableString,
} = require("../operations/operations.mapper");

/**
 * Regra inegociável: nada é inventado. Se a coluna não foi confirmada pela
 * introspecção, o campo do contrato é `null` — nunca `false`, `0` ou "".
 */

function truthyFlag(raw) {
  const n = toNullableInt(raw);
  if (n !== null) return n === 1;
  const s = toNullableString(raw);
  if (s !== null) return /^(S|SIM|T|TRUE|1)$/i.test(s);
  return null;
}

function mapActive(row, productSchema) {
  if (!productSchema.active) return null;
  const raw = pick(row, "PRODUTO_ATIVO");
  if (productSchema.active === "INATIVO") {
    const inactive = truthyFlag(raw);
    return inactive === null ? null : !inactive;
  }
  const n = toNullableInt(raw);
  if (n !== null) return n === 1;
  const s = toNullableString(raw);
  if (s !== null) return /^(S|SIM|A|ATIVO|T|TRUE|1)$/i.test(s);
  return null;
}

function mapUnit(row, schema) {
  const id = schema.product.unitId ? toNullableInt(pick(row, "ID_UNIDADE")) : null;
  const code = schema.unit.code ? toNullableString(pick(row, "UNIDADE_CODIGO")) : null;
  const description = schema.unit.description
    ? toNullableString(pick(row, "UNIDADE_DESCRICAO"))
    : null;
  if (id === null && code === null && description === null) return null;
  return { id, code, description };
}

function mapGroup(row, schema) {
  const id = schema.product.groupId ? toNullableInt(pick(row, "ID_GRUPO_PRODUTO")) : null;
  const description = schema.group.description
    ? toNullableString(pick(row, "GRUPO_DESCRICAO"))
    : null;
  if (id === null && description === null) return null;
  return { id, description };
}

function mapProductListItem(row, schema) {
  const p = schema.product;
  return {
    id: toNullableInt(pick(row, "ID_PRODUTO")),
    code: p.code ? toNullableString(pick(row, "PRODUTO_CODIGO")) : null,
    description: p.description ? toNullableString(pick(row, "PRODUTO_DESCRICAO")) : null,
    unit: mapUnit(row, schema),
    group: mapGroup(row, schema),
    companyId: p.companyId ? toNullableInt(pick(row, "PRODUTO_ID_EMPRESA")) : null,
    active: mapActive(row, p),
    blocked: p.blocked ? truthyFlag(pick(row, "PRODUTO_BLOQUEADO")) : null,
    discontinued: p.discontinued ? truthyFlag(pick(row, "PRODUTO_DESCONTINUADO")) : null,
  };
}

/** Detalhe é superset do item de listagem. Nenhum preço é exposto. */
function mapProductDetail(row, schema) {
  const p = schema.product;
  return {
    ...mapProductListItem(row, schema),
    barcode: p.barcode ? toNullableString(pick(row, "PRODUTO_CODIGO_BARRA")) : null,
    deleted: p.deleted ? truthyFlag(pick(row, "PRODUTO_DELETED")) : null,
  };
}

module.exports = { mapProductListItem, mapProductDetail, mapActive, mapUnit, mapGroup, truthyFlag };