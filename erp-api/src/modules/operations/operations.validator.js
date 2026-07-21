"use strict";

const { AppError } = require("../../shared/errors/app-error");

// Empresas atualmente permitidas pela regra de negócio.
const ALLOWED_EMPRESAS = Object.freeze([1, 3]);

/**
 * Validação estrita de string YYYY-MM-DD.
 * Não confia em `new Date(str)` — verifica formato, ranges e roundtrip.
 * Retorna { valid: true, value: "YYYY-MM-DD" } ou { valid: false, message }.
 */
function parseStrictDate(raw) {
  if (typeof raw !== "string" || raw.length !== 10) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || year > 2999) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  if (month < 1 || month > 12) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  if (day < 1 || day > 31) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  // Roundtrip UTC para pegar 2026-02-30 etc.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { valid: false, message: "Informe uma data válida no formato YYYY-MM-DD." };
  }
  return { valid: true, value: raw };
}

/**
 * Normaliza o parâmetro empresas.
 * - ausente/undefined → [1, 3]
 * - "1"  → [1]
 * - "3,1" → [1, 3]
 * Rejeita: vazio, letras, decimais, negativos, vírgulas soltas, empresas fora
 * da allowlist, valores repetidos em array (Express dupe param).
 */
function parseEmpresas(raw) {
  if (raw === undefined || raw === null) {
    return { valid: true, value: [...ALLOWED_EMPRESAS] };
  }
  if (typeof raw !== "string") {
    return { valid: false, message: "Informe empresas como lista separada por vírgula." };
  }
  if (raw.trim() === "") {
    return { valid: false, message: "Informe empresas como lista separada por vírgula." };
  }
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.some((p) => p === "")) {
    return { valid: false, message: "Informe empresas como lista separada por vírgula." };
  }
  const nums = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) {
      return { valid: false, message: "Empresas devem ser inteiros positivos." };
    }
    const n = Number(p);
    if (!Number.isInteger(n) || n <= 0) {
      return { valid: false, message: "Empresas devem ser inteiros positivos." };
    }
    if (!ALLOWED_EMPRESAS.includes(n)) {
      return {
        valid: false,
        message: `Empresa não permitida. Valores aceitos: ${ALLOWED_EMPRESAS.join(", ")}.`,
      };
    }
    nums.push(n);
  }
  const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
  return { valid: true, value: unique };
}

/**
 * Valida a query completa do endpoint GET /operations/orders.
 * Retorna { date, empresas } normalizados ou lança AppError VALIDATION_ERROR
 * com todos os erros de campo, respeitando o contrato externo da API.
 */
function validateListOrdersQuery(query) {
  const errors = [];

  // Rejeita valores múltiplos (?date=a&date=b) → Express entrega array.
  const rawDate = query.date;
  const rawEmpresas = query.empresas;

  if (rawDate === undefined || rawDate === null || rawDate === "") {
    errors.push({ field: "date", message: "O parâmetro date é obrigatório." });
  } else if (Array.isArray(rawDate)) {
    errors.push({ field: "date", message: "Informe apenas um valor para date." });
  } else {
    const r = parseStrictDate(rawDate);
    if (!r.valid) errors.push({ field: "date", message: r.message });
  }

  let empresas;
  if (Array.isArray(rawEmpresas)) {
    errors.push({ field: "empresas", message: "Informe apenas um valor para empresas." });
  } else {
    const r = parseEmpresas(rawEmpresas);
    if (!r.valid) errors.push({ field: "empresas", message: r.message });
    else empresas = r.value;
  }

  if (errors.length > 0) {
    throw new AppError({
      message: "Parâmetros inválidos.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
      details: errors,
      exposeDetails: true,
    });
  }

  return { date: rawDate, empresas };
}

module.exports = {
  ALLOWED_EMPRESAS,
  parseStrictDate,
  parseEmpresas,
  validateListOrdersQuery,
};