"use strict";

const repository = require("./pricing.repository");
const mapper = require("./pricing.mapper");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");

function queryFailed(err) {
  logger.error({ code: err && err.code }, "falha ao resolver preço no ERP");
  if (err && err.name === "AppError") return err;
  return new AppError({
    message: "Não foi possível consultar preços no ERP.",
    statusCode: 500,
    code: "PRICE_QUERY_FAILED",
    retryable: true,
  });
}

/**
 * Cascata oficial (Sprint 5):
 *   1. preço específico do cliente (quando clientId informado);
 *   2. preço padrão do produto (sem cliente e sem grupo);
 *   3. { priceFound: false }.
 *
 * Fora de escopo: grupo de cliente, tabela de preço, prazo, desconto,
 * promoção e campanha. Nenhum cálculo é feito aqui.
 */
async function resolvePrice(input) {
  try {
    if (input.clientId !== null && input.clientId !== undefined) {
      const row = await repository.findClientSpecificPrice({
        productId: input.productId,
        clientId: input.clientId,
      });
      const specific = mapper.mapPrice(row, mapper.STRATEGIES.CLIENT_SPECIFIC);
      if (specific) return specific;
    }

    const defaultRow = await repository.findDefaultPrice({ productId: input.productId });
    const fallback = mapper.mapPrice(defaultRow, mapper.STRATEGIES.DEFAULT_PRICE);
    if (fallback) return fallback;

    return { ...mapper.NOT_FOUND };
  } catch (err) {
    throw queryFailed(err);
  }
}

module.exports = { resolvePrice };