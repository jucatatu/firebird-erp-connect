"use strict";

/**
 * Mapeamento de linhas brutas do Firebird para o contrato externo da API.
 *
 * Regras aplicadas:
 *   - trim de espaços finais em CHAR/VARCHAR;
 *   - conversão numérica explícita;
 *   - datas → "YYYY-MM-DD" (sem horário);
 *   - ausência de valor → null (nunca undefined);
 *   - deduplicação de itens/equipamentos por ID;
 *   - camelCase no contrato final.
 */

// GROTT — ID do grupo de cliente historicamente vinculado à empresa 3.
// TODO(regra): o valor exato do ID do grupo GROTT precisa ser CONFIRMADO
// no servidor Windows contra a base do ERP. Enquanto não confirmado,
// null / grupos desconhecidos caem no fallback (empresa 1).
const GROTT_GROUP_ID = null; // ← preencher após confirmação no ERP real.

function pick(row, key) {
  if (!row) return undefined;
  // node-firebird retorna chaves em MAIÚSCULO quando lowercase_keys=false.
  if (key in row) return row[key];
  const upper = key.toUpperCase();
  if (upper in row) return row[upper];
  return undefined;
}

function toNullableString(v) {
  if (v === undefined || v === null) return null;
  if (Buffer.isBuffer(v)) v = v.toString("utf8");
  if (typeof v !== "string") v = String(v);
  const trimmed = v.replace(/\s+$/u, "");
  return trimmed.length === 0 ? null : trimmed;
}

function toNullableNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(v) {
  const n = toNullableNumber(v);
  if (n === null) return null;
  return Math.trunc(n);
}

/**
 * Normaliza qualquer representação de data para "YYYY-MM-DD".
 * Aceita Date, string ISO ou "YYYY-MM-DD..." e ignora horário.
 */
function toDateOnly(v) {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return toDateOnly(parsed);
  }
  return null;
}

/**
 * Inferência de empresa quando ORDEM_VENDA.ID_EMPRESA está ausente.
 *
 * Regra histórica documentada:
 *   - cliente pertencente ao grupo GROTT → empresa 3;
 *   - demais casos → empresa 1.
 *
 * ATENÇÃO: o ID exato do grupo GROTT ainda não está confirmado no
 * servidor real. Enquanto GROTT_GROUP_ID for null, TODOS os clientes
 * sem empresa explícita caem em empresa 1. Confirmar no ERP e ajustar
 * a constante GROTT_GROUP_ID acima antes de considerar a regra completa.
 */
function inferCompanyId(orderRow) {
  const explicit = toNullableInt(pick(orderRow, "ORDER_ID_EMPRESA"));
  if (explicit !== null) return explicit;
  const grupoId = toNullableInt(pick(orderRow, "CLIENTE_ID_GRUPO"));
  if (grupoId !== null && GROTT_GROUP_ID !== null && grupoId === GROTT_GROUP_ID) {
    return 3;
  }
  return 1;
}

function mapCustomer(row) {
  return {
    id: toNullableInt(pick(row, "CLIENTE_ID")),
    name: toNullableString(pick(row, "PESSOA_NOME")),
    tradeName: toNullableString(pick(row, "CLIENTE_NOME_FANTASIA")),
    phone: toNullableString(pick(row, "CLI_TELEFONE")),
  };
}

function mapAddress(row) {
  return {
    street: toNullableString(pick(row, "CLI_ENDERECO")),
    number: toNullableString(pick(row, "CLI_NUMERO_END")),
    complement: toNullableString(pick(row, "CLI_COMPLEMENTO")),
    district: toNullableString(pick(row, "BAIRRO_NOME")),
    city: toNullableString(pick(row, "CIDADE_NOME")),
    state: toNullableString(pick(row, "ESTADO_UF")),
    postalCode: toNullableString(pick(row, "CLI_CEP")),
    reference: toNullableString(pick(row, "CLI_REFERENCIA")),
  };
}

function mapStatus(row) {
  const id = toNullableInt(pick(row, "ORDER_ID_STATUS"));
  const name = toNullableString(pick(row, "STATUS_NOME"));
  return { id, name };
}

function mapItemRow(row) {
  return {
    productId: toNullableInt(pick(row, "PRODUTO_ID")),
    name: toNullableString(pick(row, "PRODUTO_NOME")),
    quantity: toNullableNumber(pick(row, "QUANTIDADE")),
    unit: toNullableString(pick(row, "UNIDADE")),
  };
}

function mapEquipmentRow(row) {
  return {
    typeId: toNullableInt(pick(row, "TIPO_ID")),
    name: toNullableString(pick(row, "TIPO_NOME")),
    quantity: toNullableNumber(pick(row, "QUANTIDADE")),
  };
}

/**
 * Deduplica linhas por chave. Preserva ordem original de primeira ocorrência.
 */
function dedupeBy(rows, keyFn) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = keyFn(r);
    if (k === undefined || k === null) {
      out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Constrói um pedido completo a partir da linha-base e das linhas de itens/equipamentos.
 */
function buildOrder(orderRow, itemRows, equipRows) {
  const items = dedupeBy(
    (itemRows || []).map(mapItemRow),
    (i) => (i.productId !== null ? `p:${i.productId}` : null),
  );
  const equipment = dedupeBy(
    (equipRows || []).map(mapEquipmentRow),
    (e) => (e.typeId !== null ? `t:${e.typeId}` : null),
  );

  return {
    id: toNullableInt(pick(orderRow, "ORDER_ID")),
    number: toNullableInt(pick(orderRow, "ORDER_NUMERO")),
    companyId: inferCompanyId(orderRow),
    status: mapStatus(orderRow),
    customer: mapCustomer(orderRow),
    delivery: {
      date: toDateOnly(pick(orderRow, "ORDER_DT_ENTREGA")),
      address: mapAddress(orderRow),
    },
    notes: toNullableString(pick(orderRow, "ORDER_OBSERVACAO")),
    items,
    equipment,
  };
}

module.exports = {
  buildOrder,
  inferCompanyId,
  toNullableString,
  toNullableNumber,
  toNullableInt,
  toDateOnly,
  dedupeBy,
  mapItemRow,
  mapEquipmentRow,
  GROTT_GROUP_ID,
};
