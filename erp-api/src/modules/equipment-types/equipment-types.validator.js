"use strict";

const { AppError } = require("../../shared/errors/app-error");

const LIMITS = Object.freeze({ Q_MIN: 2, Q_MAX: 60, LIMIT_DEFAULT: 100, LIMIT_MAX: 200 });
const ALLOWED_QUERY_KEYS = Object.freeze(["q", "limit", "active"]);

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

function validateListQuery(query) {
  const errors = [];
  for (const key of Object.keys(query || {})) {
    if (!ALLOWED_QUERY_KEYS.includes(key)) {
      errors.push({ field: key, message: `Parâmetro desconhecido: ${key}.` });
    }
  }

  const rawQ = Array.isArray(query.q) ? undefined : query.q;
  const rawLimit = Array.isArray(query.limit) ? undefined : query.limit;
  const rawActive = Array.isArray(query.active) ? undefined : query.active;
  if (Array.isArray(query.q) || Array.isArray(query.limit) || Array.isArray(query.active)) {
    errors.push({ field: "query", message: "Informe apenas um valor por parâmetro." });
  }

  let q = null;
  if (rawQ !== undefined && String(rawQ).trim() !== "") {
    const trimmed = String(rawQ).trim();
    if (trimmed.length < LIMITS.Q_MIN) {
      errors.push({ field: "q", message: `q deve ter no mínimo ${LIMITS.Q_MIN} caracteres.` });
    } else if (trimmed.length > LIMITS.Q_MAX) {
      errors.push({ field: "q", message: `q deve ter no máximo ${LIMITS.Q_MAX} caracteres.` });
    } else {
      q = trimmed;
    }
  }

  let limit = LIMITS.LIMIT_DEFAULT;
  if (rawLimit !== undefined && String(rawLimit).trim() !== "") {
    const raw = String(rawLimit).trim();
    if (!/^\d+$/.test(raw)) {
      errors.push({ field: "limit", message: "limit deve ser um inteiro positivo." });
    } else {
      const n = Number(raw);
      if (n < 1) errors.push({ field: "limit", message: "limit deve ser maior que zero." });
      else if (n > LIMITS.LIMIT_MAX)
        errors.push({ field: "limit", message: `limit máximo é ${LIMITS.LIMIT_MAX}.` });
      else limit = n;
    }
  }

  let active = null;
  if (rawActive !== undefined && String(rawActive).trim() !== "") {
    const s = String(rawActive).trim().toLowerCase();
    if (["true", "1"].includes(s)) active = true;
    else if (["false", "0"].includes(s)) active = false;
    else errors.push({ field: "active", message: "active deve ser true ou false." });
  }

  if (errors.length > 0) throw validationError(errors);
  return { q, limit, active };
}

module.exports = { LIMITS, ALLOWED_QUERY_KEYS, validateListQuery, validationError };