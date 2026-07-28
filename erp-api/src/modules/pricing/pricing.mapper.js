"use strict";

const { pick, toNullableInt, toNullableNumber } = require("../operations/operations.mapper");

const STRATEGIES = Object.freeze({
  CLIENT_SPECIFIC: "client_specific",
  DEFAULT_PRICE: "default_price",
});

/**
 * Converte a linha bruta de PRECO no contrato externo.
 *
 * Nunca inventa valor: se a linha não tiver preço numérico válido, devolve
 * null e o service trata como "preço não encontrado". Zero também é tratado
 * como ausência de preço comercial — o contrato proíbe retornar zero.
 */
function mapPrice(row, strategy) {
  if (!row) return null;
  const unitPrice = toNullableNumber(pick(row, "VALOR"));
  if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  return {
    priceFound: true,
    unitPrice,
    priceId: toNullableInt(pick(row, "ID_PRECO")),
    strategy,
  };
}

const NOT_FOUND = Object.freeze({ priceFound: false });

module.exports = { STRATEGIES, mapPrice, NOT_FOUND };