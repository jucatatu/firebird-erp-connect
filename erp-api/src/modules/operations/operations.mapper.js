"use strict";

/**
 * Mapeamento de linhas brutas do Firebird para o contrato externo da API.
 *
 * Regras aplicadas:
 *   - trim de espaços finais em CHAR/VARCHAR;
 *   - conversão numérica explícita;
 *   - datas → "YYYY-MM-DD" (sem horário);
 *   - ausência de valor → null (nunca undefined);
 *   - itens e equipamentos NÃO são deduplicados;
 *   - camelCase no contrato final.
 *
 * Resolução de empresa (regra operacional oficial):
 *   Domínio válido: {1 (Graal), 3 (Grott)}.
 *   1. ORDENS_VENDA.ID_EMPRESA se for 1 ou 3
 *   2. CLIENTES.ID_EMPRESA se for 1 ou 3
 *   3. GRUPO_CLIENTE.DESCRICAO contém "GROTT" (case-insensitive) → 3
 *   4. Caso contrário → 1 (Graal é o default; NULL representa Graal)
 *   Nunca retorna null. Valores fora de {1, 3} não são propagados.
 */

/**
 * Lê um valor de uma linha do Firebird tolerando 3 variantes de chave:
 * exata, upper-case e lower-case. node-firebird tipicamente devolve
 * chaves em maiúsculas, mas mocks/testes podem usar outras variantes.
 */
function pick(row, key) {
  if (!row) return undefined;
  if (row[key] !== undefined) return row[key];
  const upper = key.toUpperCase();
  if (row[upper] !== undefined) return row[upper];
  const lower = key.toLowerCase();
  if (row[lower] !== undefined) return row[lower];
  return undefined;
}

function toNullableString(v) {
  if (v === undefined || v === null) return null;
  // Se o driver já entregou string, não fazemos dupla conversão. Buffers
  // com WIN1252 são decodificados pelo próprio driver (charset: WIN1252)
  // — aqui apenas normalizamos strings preservando acentos já decodificados.
  if (Buffer.isBuffer(v)) {
    try {
      // eslint-disable-next-line global-require
      const iconv = require("iconv-lite");
      v = iconv.decode(v, "win1252");
    } catch (_e) {
      v = v.toString("binary");
    }
  }
  if (typeof v !== "string") v = String(v);
  const trimmed = v.trim();
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
 * Extrai "HH:mm" de um valor TIME/TIMESTAMP do Firebird.
 *
 * Regras:
 *   - `Date`: usa hora LOCAL (getHours/getMinutes) — o driver node-firebird
 *     devolve TIMESTAMP como Date em fuso local, então nenhuma conversão
 *     de fuso adicional é aplicada.
 *   - string "HH:mm[:ss]": valida e retorna "HH:mm".
 *   - string "YYYY-MM-DDTHH:mm[:ss]...": extrai HH:mm literal.
 *   - `00:00` NÃO é descartado. `DATA_PREV_ENTREGA` é TIMESTAMP e valores
 *     de meia-noite (00:00, 00:33, etc.) foram confirmados como horários
 *     reais de entrega no ERP.
 *   - Qualquer outro valor → null.
 *
 * Nunca lança. Nunca retorna "Invalid Date".
 */
function toTimeOnly(v) {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const h = v.getHours();
    const m = v.getMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    const hhmm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const m = Number(hhmm[2]);
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    const iso = /^\d{4}-\d{2}-\d{2}[Tt](\d{2}):(\d{2})/.exec(s);
    if (iso) {
      const h = Number(iso[1]);
      const m = Number(iso[2]);
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return null;
}

function orEmpty(v) {
  const s = toNullableString(v);
  return s === null ? "" : s;
}

function mapAddress(row) {
  return {
    street: orEmpty(pick(row, "RUA")),
    number: orEmpty(pick(row, "NUMERO")),
    complement: orEmpty(pick(row, "COMPLEMENTO")),
    neighborhood: orEmpty(pick(row, "BAIRRO")),
    city: orEmpty(pick(row, "CIDADE")),
    state: orEmpty(pick(row, "UF")),
  };
}

function mapClientName(row) {
  const nome = toNullableString(pick(row, "CLIENTE_NOME"));
  const apelido = toNullableString(pick(row, "CLIENTE_APELIDO"));
  return nome || apelido || "";
}

/**
 * Resolve a empresa oficial do pedido conforme a regra do ERP.
 * Retorna sempre 1 ou 3 — nunca null. Valores fora de {1, 3} são ignorados
 * e o próximo nível de fallback é avaliado.
 */
function resolveCompanyId(row) {
  const ordem = toNullableInt(pick(row, "ORDEM_ID_EMPRESA"));
  if (ordem === 1 || ordem === 3) return ordem;
  const cliente = toNullableInt(pick(row, "CLIENTE_ID_EMPRESA"));
  if (cliente === 1 || cliente === 3) return cliente;
  const grupo = toNullableString(pick(row, "GRUPO_CLIENTE_DESCRICAO"));
  if (grupo && /grott/i.test(grupo)) return 3;
  return 1;
}

function mapItemRow(row) {
  return {
    productId: toNullableInt(pick(row, "ID_PRODUTO")),
    product: toNullableString(pick(row, "PRODUTO")),
    quantity: toNullableNumber(pick(row, "QUANTIDADE")),
    unitPrice: toNullableNumber(pick(row, "VALOR_UNITARIO")),
    total: toNullableNumber(pick(row, "VALOR_TOTAL")),
  };
}

function mapEquipmentRow(row) {
  return {
    typeId: toNullableInt(pick(row, "ID_TIPO_EQUIPAMENTO")),
    type: toNullableString(pick(row, "TIPO")),
    quantity: toNullableNumber(pick(row, "QUANTIDADE")),
  };
}

/**
 * Deduplica linhas por chave. Preserva ordem original de primeira ocorrência.
 * Mantido como utilitário: NÃO é usado para itens/equipamentos.
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
 * Constrói um pedido completo a partir da linha-base, telefone escolhido
 * e das linhas de itens/equipamentos (sem deduplicação).
 *
 * @param {object} orderRow — linha bruta de ORDENS_VENDA + joins.
 * @param {string|null} phone — telefone já escolhido pelo service.
 * @param {Array<object>} itemRows
 * @param {Array<object>} equipRows
 */
function buildOrder(orderRow, phone, itemRows, equipRows) {
  const orderNumberRaw = pick(orderRow, "N_PEDIDO");
  const orderNumberStr =
    orderNumberRaw === null || orderNumberRaw === undefined
      ? ""
      : String(orderNumberRaw).trim();

  // Horário de entrega: a fonte canônica é o TIMESTAMP DATA_PREV_ENTREGA.
  // O MESMO valor bruto é reprocessado — nunca extraia hora do resultado
  // já convertido para YYYY-MM-DD.
  const rawExpectedDelivery = pick(orderRow, "DATA_PREV_ENTREGA");
  const deliveryTime = toTimeOnly(rawExpectedDelivery);

  return {
    orderId: toNullableInt(pick(orderRow, "ID_ORDENS_VENDA")),
    orderNumber: orderNumberStr,
    clientId: toNullableInt(pick(orderRow, "ID_CLIENTE")),
    clientName: mapClientName(orderRow),
    phone: phone === undefined ? null : phone,
    expectedDelivery: toDateOnly(rawExpectedDelivery),
    deliveryTime,
    expectedReturn: toDateOnly(pick(orderRow, "DATA_PREV_RETORNO")),
    observations: toNullableString(pick(orderRow, "OBS")),
    erpStatus: toNullableString(pick(orderRow, "STATUS_DESCRICAO")),
    companyId: resolveCompanyId(orderRow),
    address: mapAddress(orderRow),
    items: (itemRows || []).map(mapItemRow),
    equipments: (equipRows || []).map(mapEquipmentRow),
  };
}

module.exports = {
  buildOrder,
  resolveCompanyId,
  pick,
  toNullableString,
  toNullableNumber,
  toNullableInt,
  toDateOnly,
  toTimeOnly,
  dedupeBy,
  mapItemRow,
  mapEquipmentRow,
  mapAddress,
  mapClientName,
};
