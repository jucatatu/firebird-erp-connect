"use strict";

const repository = require("./clients.repository");
const mapper = require("./clients.mapper");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");
const {
  pick,
  toNullableInt,
  toNullableString,
} = require("../operations/operations.mapper");
const { LIMITS } = require("./clients.validator");

function queryFailed(err, context) {
  // Nunca propaga SQL, stack ou mensagem bruta do driver.
  logger.error(
    { code: err && err.code, context },
    "falha ao consultar clientes no ERP",
  );
  if (err && err.name === "AppError") return err;
  return new AppError({
    message: "Não foi possível consultar clientes no ERP.",
    statusCode: 500,
    code: "CLIENT_QUERY_FAILED",
    retryable: true,
  });
}

/** Telefones prioritários (CELULAR → FONE) em UMA consulta em lote. */
async function loadPhones(clientIds) {
  if (clientIds.length === 0) return new Map();
  const rows = (await repository.findPhonesByClientIds(clientIds)) || [];
  const byClient = new Map();
  for (const row of rows) {
    const cid = toNullableInt(pick(row, "ID_CLIENTE"));
    if (cid === null || byClient.has(cid)) continue;
    const tel = toNullableString(pick(row, "TELEFONE"));
    if (tel !== null) byClient.set(cid, tel);
  }
  return byClient;
}

/** Endereço do último pedido em UMA consulta em lote (fallback). */
async function loadLastOrderAddresses(clientIds) {
  if (clientIds.length === 0) return new Map();
  const rows = (await repository.findLastOrderAddressByClientIds(clientIds)) || [];
  const byClient = new Map();
  for (const row of rows) {
    const cid = toNullableInt(pick(row, "ID_CLIENTE"));
    if (cid === null || byClient.has(cid)) continue;
    byClient.set(cid, mapper.mapLastOrderAddress(row));
  }
  return byClient;
}

/**
 * Busca paginada de clientes.
 *
 * Paginação: keyset determinística por ID_CLIENTE ASC. `nextCursor` é o
 * maior ID_CLIENTE varrido nesta página (não o último item exibido), de
 * modo que o filtro pós-resolução por companyId nunca causa loop nem
 * salto de registros.
 */
async function searchClients(input) {
  try {
    const clientIdFilter = input.phone
      ? (await repository.findClientIdsByPhoneDigits(input.phone, LIMITS.LIMIT_MAX * 4)).map(
          (r) => toNullableInt(pick(r, "ID_CLIENTE")),
        ).filter((n) => n !== null)
      : null;

    const { rows, schema } = await repository.searchClients({
      qPatterns: input.q ? mapper.buildQPatterns(input.q) : null,
      qRaw: input.q,
      documentDigits: input.document,
      cityPattern: input.city ? mapper.exactLikePattern(input.city) : null,
      clientIdFilter,
      limit: input.limit,
      cursor: input.cursor,
    });

    const ids = [];
    let maxScannedId = input.cursor;
    for (const row of rows) {
      const id = toNullableInt(pick(row, "ID_CLIENTE"));
      if (id === null) continue;
      ids.push(id);
      if (maxScannedId === null || id > maxScannedId) maxScannedId = id;
    }

    const needsFallbackAddress =
      !schema.client.cityId && !schema.client.streetId && !schema.client.districtId;

    const [phones, fallbackAddresses] = await Promise.all([
      loadPhones(ids),
      needsFallbackAddress ? loadLastOrderAddresses(ids) : Promise.resolve(new Map()),
    ]);

    let clients = rows.map((row) => {
      const id = toNullableInt(pick(row, "ID_CLIENTE"));
      return mapper.mapClientListItem(row, schema, {
        phone: id === null ? null : phones.get(id) || null,
        address:
          mapper.mapRegisteredAddress(row, schema) ||
          (id === null ? null : fallbackAddresses.get(id) || null),
      });
    });

    // companyId filtra o resultado; NUNCA redefine a empresa do cadastro.
    if (input.companyId !== null && input.companyId !== undefined) {
      clients = clients.filter((c) => c.companyId === input.companyId);
    }
    // Filtro de cidade quando o cadastro não tem cidade estruturada.
    if (input.city && needsFallbackAddress) {
      const needle = input.city.toUpperCase();
      clients = clients.filter((c) => (c.city || "").toUpperCase().includes(needle));
    }

    const hasMore = rows.length === input.limit;
    return {
      count: clients.length,
      scanned: rows.length,
      limit: input.limit,
      nextCursor: hasMore && maxScannedId !== null ? String(maxScannedId) : null,
      clients,
    };
  } catch (err) {
    throw queryFailed(err, "search");
  }
}

async function getClientById(clientId) {
  let row;
  let schema;
  try {
    const found = await repository.findClientById(clientId);
    row = found.row;
    schema = found.schema;
  } catch (err) {
    throw queryFailed(err, "detail");
  }

  if (!row) {
    throw new AppError({
      message: "Cliente não encontrado.",
      statusCode: 404,
      code: "CLIENT_NOT_FOUND",
      retryable: false,
    });
  }

  try {
    const registered = mapper.mapRegisteredAddress(row, schema);
    const [phones, fallback] = await Promise.all([
      loadPhones([clientId]),
      registered ? Promise.resolve(new Map()) : loadLastOrderAddresses([clientId]),
    ]);
    return mapper.mapClientDetail(row, schema, {
      phone: phones.get(clientId) || null,
      address: registered || fallback.get(clientId) || null,
    });
  } catch (err) {
    throw queryFailed(err, "detail-enrich");
  }
}

module.exports = { searchClients, getClientById };
