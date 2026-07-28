"use strict";

/**
 * Mascaramento de dados pessoais. Usado em TODAS as respostas de clientes.
 * A API nunca devolve CPF/CNPJ ou telefone integrais.
 */

function onlyDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D+/g, "");
}

/**
 * Mascara CPF (11 dígitos) ou CNPJ (14 dígitos), preservando apenas os
 * primeiros e últimos dígitos.
 *   CPF   → "123.***.***-00"
 *   CNPJ  → "12.xxx.xxx-00" (grupos centrais mascarados)
 * Outros comprimentos → mantém 2 primeiros e 2 últimos.
 * Vazio/nulo → null.
 */
function maskDocument(value) {
  const d = onlyDigits(value);
  if (!d) return null;
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  if (d.length <= 4) return "*".repeat(d.length);
  return `${d.slice(0, 2)}${"*".repeat(Math.max(d.length - 4, 1))}${d.slice(-2)}`;
}

/** Classifica o documento pelo número de dígitos. */
function documentType(value) {
  const d = onlyDigits(value);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  if (!d) return null;
  return "unknown";
}

/**
 * Mascara telefone preservando DDD e os 4 últimos dígitos.
 *   "47999887766" → "(47) *****-7766"
 */
function maskPhone(value) {
  const d = onlyDigits(value);
  if (!d) return null;
  if (d.length <= 4) return "*".repeat(d.length);
  if (d.length <= 8) return `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
  const ddd = d.slice(0, 2);
  return `(${ddd}) ${"*".repeat(d.length - 6)}-${d.slice(-4)}`;
}

module.exports = { onlyDigits, maskDocument, documentType, maskPhone };
