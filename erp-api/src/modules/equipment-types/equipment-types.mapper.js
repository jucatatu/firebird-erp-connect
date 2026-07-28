"use strict";

const {
  pick,
  toNullableInt,
  toNullableString,
} = require("../operations/operations.mapper");
const { truthyFlag } = require("../products/products.mapper");

/**
 * IMPORTANTE — categoria operacional NÃO é inferida aqui.
 *
 * O ERP não possui (até a introspecção desta sprint) coluna estruturada que
 * separe chopeira / cilindro / barril retornável. Classificar por regex sobre
 * a descrição seria heurística disfarçada de regra oficial. Portanto o
 * contrato devolve `category: null` e `returnable: null`, e a decisão
 * continua explicitamente do lado do frontend até existir dado estruturado.
 */
function mapEquipmentType(row, schema) {
  const t = schema.type;
  let active = null;
  if (t.active) {
    const raw = pick(row, "TIPO_ATIVO");
    const flag = truthyFlag(raw);
    active = t.active === "INATIVO" ? (flag === null ? null : !flag) : flag;
  }
  return {
    id: toNullableInt(pick(row, "ID_TIPO_EQUIPAMENTO")),
    code: t.code ? toNullableString(pick(row, "TIPO_CODIGO")) : null,
    description: t.description ? toNullableString(pick(row, "TIPO_DESCRICAO")) : null,
    companyId: t.companyId ? toNullableInt(pick(row, "TIPO_ID_EMPRESA")) : null,
    active,
    category: null,
    returnable: null,
  };
}

module.exports = { mapEquipmentType };