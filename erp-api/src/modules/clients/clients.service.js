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
const { LIMITS, digitsOnly } = require("./clients.validator");
const { maskDocument } = require("../../shared/utils/mask");

function queryFailed(err, context) {
  logger.error(
    { code: err && err.code, context, err: err.message },
    "falha na operação de clientes no ERP",
  );
  if (err && err.name === "AppError") return err;
  return new AppError({
    message: "Não foi possível realizar a operação no ERP.",
    statusCode: 500,
    code: "CLIENT_OPERATION_FAILED",
    retryable: true,
  });
}

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

async function searchClients(input) {
  try {
    const clientIdFilter = input.phone
      ? (await repository.findClientIdsByPhoneDigits(input.phone, LIMITS.LIMIT_MAX * 4)).map(
          (r) => toNullableInt(pick(r, "ID_CLIENTE")),
        ).filter((n) => n !== null)
      : null;

    const { rows, schema } = await repository.searchClients({
      qPatterns: input.q ? mapper.sharedBuildQPatterns(input.q) : null,
      qRaw: input.q,
      documentDigits: input.document,
      cityPattern: input.city ? mapper.sharedBuildQPatterns(input.city)[0] : null,
      clientIdFilter,
      companyId: input.companyId,
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

    const [phones, fallbackAddresses] = await Promise.all([
      loadPhones(ids),
      loadLastOrderAddresses(ids),
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

    if (input.companyId !== null && input.companyId !== undefined) {
      clients = clients.filter((c) => c.companyId === input.companyId);
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
      loadLastOrderAddresses([clientId]),
    ]);
    return mapper.mapClientDetail(row, schema, {
      phone: phones.get(clientId) || null,
      address: registered || fallback.get(clientId) || null,
    });
  } catch (err) {
    throw queryFailed(err, "detail-enrich");
  }
}

/**
 * Criação de novo cliente com validação de duplicidade.
 */
async function createClient(data) {
  try {
    // 1. Validar Duplicidade
    const existing = await repository.findClientByDocument(data.document);
    if (existing) {
      const schema = await repository.getSchema();
      throw new AppError({
        message: "Este CPF/CNPJ já possui cadastro no ERP.",
        statusCode: 409,
        code: "CLIENT_ALREADY_EXISTS",
        retryable: false,
        details: {
          clientId: pick(existing, "ID_CLIENTE"),
          name: mapper.mapName(existing),
          tradeName: toNullableString(pick(existing, "CLIENTE_APELIDO")),
          document: maskDocument(data.document),
          companyId: mapper.resolveCompany(existing, schema)
        },
        exposeDetails: true
      });
    }

    // 2. Mapear Parâmetros
    const clientParams = mapper.buildCreateClientProcedureParams(data);
    const contactParams = mapper.buildCreateContactParams(null, data);

    // 3. Executar Transação
    const { clientId, personId } = await repository.createClientTransaction(clientParams, contactParams);

    // 4. Retornar Detalhe do Novo Cliente
    return await getClientById(clientId);
  } catch (err) {
    if (err.name === "AppError") throw err;
    throw queryFailed(err, "create");
  }
}

module.exports = { searchClients, getClientById, createClient };
