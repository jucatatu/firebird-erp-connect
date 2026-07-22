"use strict";

const { env } = require("../../config/env");
const { AppError } = require("../../shared/errors/app-error");

const ALLOWED_COMPANIES = Object.freeze([1, 3]);

function invalid(details) {
  throw new AppError({
    message: "Parâmetros inválidos.",
    statusCode: 400,
    code: "VALIDATION_ERROR",
    retryable: false,
    details,
    exposeDetails: true,
  });
}

function parseStrictDate(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return raw;
}

function validateMapOrdersQuery(query) {
  const errors = [];
  const rawDate = query.date;
  if (!rawDate || Array.isArray(rawDate)) {
    errors.push({ field: "date", message: "O parâmetro date é obrigatório (YYYY-MM-DD)." });
  } else if (!parseStrictDate(rawDate)) {
    errors.push({ field: "date", message: "date deve estar no formato YYYY-MM-DD." });
  }

  let companyId;
  const rawCompany = query.companyId ?? query.company_id;
  if (rawCompany !== undefined && rawCompany !== null && rawCompany !== "") {
    if (Array.isArray(rawCompany)) {
      errors.push({ field: "companyId", message: "Informe apenas um companyId." });
    } else {
      const n = Number(rawCompany);
      if (!Number.isInteger(n) || !ALLOWED_COMPANIES.includes(n)) {
        errors.push({
          field: "companyId",
          message: `companyId inválido. Valores aceitos: ${ALLOWED_COMPANIES.join(", ")}.`,
        });
      } else {
        companyId = n;
      }
    }
  }

  if (errors.length > 0) invalid(errors);
  return { date: rawDate, companyId: companyId ?? null };
}

function validateGeocodeBody(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid([{ field: "body", message: "Corpo JSON obrigatório." }]);
  }
  const { orderIds, limit } = body;

  if (!Array.isArray(orderIds)) {
    errors.push({ field: "orderIds", message: "orderIds deve ser um array de inteiros." });
  } else if (orderIds.length === 0) {
    errors.push({ field: "orderIds", message: "orderIds não pode ser vazio." });
  } else if (orderIds.length > env.GEOCODING_MAX_PER_REQUEST) {
    errors.push({
      field: "orderIds",
      message: `orderIds excede o limite (${env.GEOCODING_MAX_PER_REQUEST}).`,
    });
  } else {
    for (const id of orderIds) {
      if (!Number.isInteger(id) || id <= 0) {
        errors.push({ field: "orderIds", message: "orderIds deve conter inteiros positivos." });
        break;
      }
    }
  }

  let normalizedLimit = env.GEOCODING_MAX_PER_REQUEST;
  if (limit !== undefined && limit !== null) {
    if (!Number.isInteger(limit) || limit <= 0) {
      errors.push({ field: "limit", message: "limit deve ser inteiro positivo." });
    } else {
      normalizedLimit = Math.min(limit, env.GEOCODING_MAX_PER_REQUEST);
    }
  }

  if (errors.length > 0) invalid(errors);

  // Dedup preservando ordem.
  const seen = new Set();
  const unique = [];
  for (const id of orderIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  return { orderIds: unique, limit: normalizedLimit };
}

module.exports = { validateMapOrdersQuery, validateGeocodeBody, ALLOWED_COMPANIES };
