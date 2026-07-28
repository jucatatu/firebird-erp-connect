"use strict";

const { AppError } = require("../../shared/errors/app-error");
const { ALLOWED_COMPANY_IDS } = require("../../shared/company/company-rule");
const { decodeCursor } = require("../../shared/pagination/keyset-cursor");

const LIMITS = Object.freeze({
  Q_MIN: 3,
  Q_MAX: 60,
  CODE_MAX: 30,
  LIMIT_DEFAULT: 20,
  LIMIT_MAX: 50,
  ID_MAX: 2147483647,
});

const ALLOWED_QUERY_KEYS = Object.freeze([
  "q",
  "productId",
  "companyId",
  "active",
  "limit",
  "cursor",
  "groupId",
  "unitId",
  "code",
]);

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

function single(value, field, errors) {
  if (Array.isArray(value)) {
    errors.push({ field, message: `Informe apenas um valor para ${field}.` });
    return undefined;
  }
  return value;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function parseId(raw, field, errors) {
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    errors.push({ field, message: `${field} deve ser um inteiro positivo.` });
    return null;
  }
  const n = Number(str);
  if (n < 1 || n > LIMITS.ID_MAX) {
    errors.push({ field, message: `${field} fora do intervalo permitido.` });
    return null;
  }
  return n;
}

function parseBoolean(raw, field, errors) {
  const str = String(raw).trim().toLowerCase();
  if (["true", "1"].includes(str)) return true;
  if (["false", "0"].includes(str)) return false;
  errors.push({ field, message: `${field} deve ser true ou false.` });
  return null;
}

/** Valida GET /api/v1/products. Campos desconhecidos são rejeitados. */
function validateSearchQuery(query) {
  const errors = [];

  for (const key of Object.keys(query || {})) {
    if (!ALLOWED_QUERY_KEYS.includes(key)) {
      errors.push({ field: key, message: `Parâmetro desconhecido: ${key}.` });
    }
  }

  const q = single(query.q, "q", errors);
  const productIdRaw = single(query.productId, "productId", errors);
  const companyIdRaw = single(query.companyId, "companyId", errors);
  const activeRaw = single(query.active, "active", errors);
  const limitRaw = single(query.limit, "limit", errors);
  const cursorRaw = single(query.cursor, "cursor", errors);
  const groupIdRaw = single(query.groupId, "groupId", errors);
  const unitIdRaw = single(query.unitId, "unitId", errors);
  const codeRaw = single(query.code, "code", errors);

  let qValue = null;
  if (present(q)) {
    const trimmed = String(q).trim();
    if (trimmed.length < LIMITS.Q_MIN) {
      errors.push({ field: "q", message: `q deve ter no mínimo ${LIMITS.Q_MIN} caracteres.` });
    } else if (trimmed.length > LIMITS.Q_MAX) {
      errors.push({ field: "q", message: `q deve ter no máximo ${LIMITS.Q_MAX} caracteres.` });
    } else {
      qValue = trimmed;
    }
  }

  const productId = present(productIdRaw) ? parseId(productIdRaw, "productId", errors) : null;
  const groupId = present(groupIdRaw) ? parseId(groupIdRaw, "groupId", errors) : null;
  const unitId = present(unitIdRaw) ? parseId(unitIdRaw, "unitId", errors) : null;

  let code = null;
  if (present(codeRaw)) {
    const trimmed = String(codeRaw).trim();
    if (trimmed.length > LIMITS.CODE_MAX) {
      errors.push({ field: "code", message: `code deve ter no máximo ${LIMITS.CODE_MAX} caracteres.` });
    } else {
      code = trimmed;
    }
  }

  let companyId = null;
  if (present(companyIdRaw)) {
    const raw = String(companyIdRaw).trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!ALLOWED_COMPANY_IDS.includes(n)) {
      errors.push({
        field: "companyId",
        message: `companyId deve ser ${ALLOWED_COMPANY_IDS.join(" ou ")}.`,
      });
    } else {
      companyId = n;
    }
  }

  const active = present(activeRaw) ? parseBoolean(activeRaw, "active", errors) : null;

  let limit = LIMITS.LIMIT_DEFAULT;
  if (present(limitRaw)) {
    const raw = String(limitRaw).trim();
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

  let cursor = null;
  if (present(cursorRaw)) {
    const decoded = decodeCursor(String(cursorRaw));
    if (!decoded) errors.push({ field: "cursor", message: "cursor inválido." });
    else cursor = decoded.lastId;
  }

  if (errors.length > 0) throw validationError(errors);

  return { q: qValue, productId, groupId, unitId, code, companyId, active, limit, cursor };
}

function validateProductId(raw) {
  const errors = [];
  const value = Array.isArray(raw) ? undefined : raw;
  const id = present(value) ? parseId(value, "productId", errors) : null;
  if (id === null && errors.length === 0) {
    errors.push({ field: "productId", message: "productId deve ser um inteiro positivo." });
  }
  if (errors.length > 0) throw validationError(errors);
  return id;
}

module.exports = { LIMITS, ALLOWED_QUERY_KEYS, validateSearchQuery, validateProductId, validationError };