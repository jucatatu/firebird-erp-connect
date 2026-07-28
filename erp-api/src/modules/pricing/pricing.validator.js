"use strict";

const { AppError } = require("../../shared/errors/app-error");

const LIMITS = Object.freeze({ ID_MAX: 2147483647 });
const ALLOWED_QUERY_KEYS = Object.freeze(["productId", "clientId"]);

function validationError(errors) {
  return new AppError({
    message: "Parâmetros inválidos.",
    statusCode: 400,
    code: "VALIDATION_ERROR",
    retryable: false,
    details: errors,
    exposeDetails: true,
  });
}

/** Inteiro positivo estrito. Rejeita "1 OR 1=1", "1;DROP", "1.5", " ", arrays. */
function parsePositiveInt(raw, field, errors) {
  const value = String(raw).trim();
  if (!/^\d+$/.test(value)) {
    errors.push({ field, message: `${field} deve ser um inteiro positivo.` });
    return null;
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > LIMITS.ID_MAX) {
    errors.push({ field, message: `${field} fora do intervalo permitido.` });
    return null;
  }
  return n;
}

function validateResolveQuery(query) {
  const errors = [];
  const q = query || {};

  for (const key of Object.keys(q)) {
    if (!ALLOWED_QUERY_KEYS.includes(key)) {
      errors.push({ field: key, message: `Parâmetro desconhecido: ${key}.` });
    }
  }
  if (Array.isArray(q.productId) || Array.isArray(q.clientId)) {
    errors.push({ field: "query", message: "Informe apenas um valor por parâmetro." });
    throw validationError(errors);
  }

  let productId = null;
  if (q.productId === undefined || String(q.productId).trim() === "") {
    errors.push({ field: "productId", message: "productId é obrigatório." });
  } else {
    productId = parsePositiveInt(q.productId, "productId", errors);
  }

  let clientId = null;
  if (q.clientId !== undefined && String(q.clientId).trim() !== "") {
    clientId = parsePositiveInt(q.clientId, "clientId", errors);
  }

  if (errors.length > 0) throw validationError(errors);
  return { productId, clientId };
}

module.exports = { LIMITS, ALLOWED_QUERY_KEYS, validateResolveQuery, validationError };