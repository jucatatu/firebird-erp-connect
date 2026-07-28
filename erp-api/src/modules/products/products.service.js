"use strict";

const repository = require("./products.repository");
const mapper = require("./products.mapper");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");
const { buildQPatterns } = require("../../shared/search/like-pattern");
const { encodeCursor } = require("../../shared/pagination/keyset-cursor");
const { validationError } = require("./products.validator");
const { pick, toNullableInt } = require("../operations/operations.mapper");

function queryFailed(err, context) {
  logger.error({ code: err && err.code, context }, "falha ao consultar produtos no ERP");
  if (err && err.name === "AppError") return err;
  return new AppError({
    message: "Não foi possível consultar produtos no ERP.",
    statusCode: 500,
    code: "PRODUCT_QUERY_FAILED",
    retryable: true,
  });
}

/**
 * Busca paginada de produtos.
 *
 * Pelo menos um filtro é obrigatório: não existe "listar tudo".
 * Paginação keyset por ID do produto ASC; `nextCursor` é o MAIOR id varrido
 * nesta página (não o último item exibido), de modo que filtros aplicados
 * após a consulta nunca causem loop nem salto de registros.
 */
async function searchProducts(input) {
  const hasFilter =
    Boolean(input.q) ||
    input.productId !== null ||
    input.groupId !== null ||
    input.unitId !== null ||
    Boolean(input.code);
  if (!hasFilter) {
    throw validationError([
      {
        field: "q",
        message: "Informe ao menos um filtro (q, productId, code, groupId ou unitId).",
      },
    ]);
  }

  let schema;
  try {
    schema = await repository.getSchema();
  } catch (err) {
    throw queryFailed(err, "schema");
  }

  if (input.companyId !== null && !schema.product.companyId) {
    throw validationError([
      {
        field: "companyId",
        message: "Este ERP não vincula produtos a empresa; remova o filtro companyId.",
      },
    ]);
  }

  try {
    const { rows } = await repository.searchProducts({
      qPatterns: input.q ? buildQPatterns(input.q) : null,
      qRaw: input.q,
      productId: input.productId,
      groupId: input.groupId,
      unitId: input.unitId,
      code: input.code,
      companyId: input.companyId,
      limit: input.limit,
      cursor: input.cursor,
    });

    let maxScannedId = input.cursor;
    for (const row of rows) {
      const id = toNullableInt(pick(row, "ID_PRODUTO"));
      if (id === null) continue;
      if (maxScannedId === null || id > maxScannedId) maxScannedId = id;
    }

    let products = rows.map((row) => mapper.mapProductListItem(row, schema));

    // `active` filtra o resultado apenas quando a coluna foi confirmada.
    if (input.active !== null && schema.product.active) {
      products = products.filter((p) => p.active === input.active);
    }

    const hasMore = rows.length === input.limit;
    return {
      count: products.length,
      scanned: rows.length,
      limit: input.limit,
      nextCursor: hasMore && maxScannedId !== null ? encodeCursor(maxScannedId) : null,
      products,
    };
  } catch (err) {
    throw queryFailed(err, "search");
  }
}

async function getProductById(productId) {
  let found;
  try {
    found = await repository.findProductById(productId);
  } catch (err) {
    throw queryFailed(err, "detail");
  }
  if (!found.row) {
    throw new AppError({
      message: "Produto não encontrado.",
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
      retryable: false,
    });
  }
  try {
    return mapper.mapProductDetail(found.row, found.schema);
  } catch (err) {
    throw queryFailed(err, "detail-map");
  }
}

module.exports = { searchProducts, getProductById };