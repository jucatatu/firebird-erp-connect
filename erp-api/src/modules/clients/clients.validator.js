"use strict";

const { AppError } = require("../../shared/errors/app-error");
const { ALLOWED_COMPANY_IDS } = require("../../shared/company/company-rule");

const LIMITS = Object.freeze({
  Q_MIN: 3,
  Q_MAX: 60,
  DOCUMENT_MIN_DIGITS: 3,
  DOCUMENT_MAX_DIGITS: 14,
  PHONE_MIN_DIGITS: 4,
  PHONE_MAX_DIGITS: 15,
  CITY_MIN: 3,
  CITY_MAX: 60,
  LIMIT_DEFAULT: 20,
  LIMIT_MAX: 50,
  CLIENT_ID_MAX: 2147483647,
});

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

function digitsOnly(value) {
  return String(value).replace(/\D+/g, "");
}

/**
 * Valida GET /api/v1/clients.
 * Contrato: pelo menos um filtro de busca (q, document, phone, city) é
 * obrigatório — exceto em continuação explícita por cursor.
 */
function validateSearchQuery(query) {
  const errors = [];
  const q = single(query.q, "q", errors);
  const document = single(query.document, "document", errors);
  const phone = single(query.phone, "phone", errors);
  const city = single(query.city, "city", errors);
  const companyIdRaw = single(query.companyId, "companyId", errors);
  const limitRaw = single(query.limit, "limit", errors);
  const cursorRaw = single(query.cursor, "cursor", errors);

  let qValue = null;
  if (q !== undefined && q !== null && String(q).trim() !== "") {
    const trimmed = String(q).trim();
    if (trimmed.length < LIMITS.Q_MIN) {
      errors.push({ field: "q", message: `q deve ter no mínimo ${LIMITS.Q_MIN} caracteres.` });
    } else if (trimmed.length > LIMITS.Q_MAX) {
      errors.push({ field: "q", message: `q deve ter no máximo ${LIMITS.Q_MAX} caracteres.` });
    } else {
      qValue = trimmed;
    }
  }

  let documentValue = null;
  if (document !== undefined && document !== null && String(document).trim() !== "") {
    const d = digitsOnly(document);
    if (d.length < LIMITS.DOCUMENT_MIN_DIGITS || d.length > LIMITS.DOCUMENT_MAX_DIGITS) {
      errors.push({
        field: "document",
        message: `document deve conter entre ${LIMITS.DOCUMENT_MIN_DIGITS} e ${LIMITS.DOCUMENT_MAX_DIGITS} dígitos.`,
      });
    } else {
      documentValue = d;
    }
  }

  let phoneValue = null;
  if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
    const d = digitsOnly(phone);
    if (d.length < LIMITS.PHONE_MIN_DIGITS || d.length > LIMITS.PHONE_MAX_DIGITS) {
      errors.push({
        field: "phone",
        message: `phone deve conter entre ${LIMITS.PHONE_MIN_DIGITS} e ${LIMITS.PHONE_MAX_DIGITS} dígitos.`,
      });
    } else {
      phoneValue = d;
    }
  }

  let cityValue = null;
  if (city !== undefined && city !== null && String(city).trim() !== "") {
    const trimmed = String(city).trim();
    if (trimmed.length < LIMITS.CITY_MIN || trimmed.length > LIMITS.CITY_MAX) {
      errors.push({
        field: "city",
        message: `city deve ter entre ${LIMITS.CITY_MIN} e ${LIMITS.CITY_MAX} caracteres.`,
      });
    } else {
      cityValue = trimmed;
    }
  }

  let companyId = null;
  if (companyIdRaw !== undefined && companyIdRaw !== null && String(companyIdRaw).trim() !== "") {
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

  let limit = LIMITS.LIMIT_DEFAULT;
  if (limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== "") {
    const raw = String(limitRaw).trim();
    if (!/^\d+$/.test(raw)) {
      errors.push({ field: "limit", message: "limit deve ser um inteiro positivo." });
    } else {
      const n = Number(raw);
      if (n < 1) {
        errors.push({ field: "limit", message: "limit deve ser maior que zero." });
      } else if (n > LIMITS.LIMIT_MAX) {
        errors.push({ field: "limit", message: `limit máximo é ${LIMITS.LIMIT_MAX}.` });
      } else {
        limit = n;
      }
    }
  }

  let cursor = null;
  if (cursorRaw !== undefined && cursorRaw !== null && String(cursorRaw).trim() !== "") {
    const raw = String(cursorRaw).trim();
    if (!/^\d+$/.test(raw) || Number(raw) > LIMITS.CLIENT_ID_MAX) {
      errors.push({ field: "cursor", message: "cursor inválido." });
    } else {
      cursor = Number(raw);
    }
  }

  const hasFilter = Boolean(qValue || documentValue || phoneValue || cityValue);
  if (!hasFilter && cursor === null && errors.length === 0) {
    errors.push({
      field: "q",
      message: "Informe ao menos um filtro de busca (q, document, phone ou city) ou um cursor.",
    });
  }

  if (errors.length > 0) throw validationError(errors);

  return {
    q: qValue,
    document: documentValue,
    phone: phoneValue,
    city: cityValue,
    companyId,
    limit,
    cursor,
  };
}

/** Valida o path param :clientId. */
function validateClientId(raw) {
  const value = Array.isArray(raw) ? undefined : raw;
  const str = value === undefined || value === null ? "" : String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw validationError([{ field: "clientId", message: "clientId deve ser um inteiro positivo." }]);
  }
  const n = Number(str);
  if (n < 1 || n > LIMITS.CLIENT_ID_MAX) {
    throw validationError([{ field: "clientId", message: "clientId fora do intervalo permitido." }]);
  }
  return n;
}

module.exports = { LIMITS, validateSearchQuery, validateClientId, digitsOnly };
