"use strict";

/**
 * REGRA OFICIAL DE EMPRESA — implementação única do projeto.
 *
 * Domínio válido: 1 = Graal, 3 = Grott. Nenhum outro valor é aceito.
 *
 * Prioridade:
 *   1. empresa explícita do contexto (pedido / payload / filtro) se ∈ {1,3}
 *   2. empresa do cliente se ∈ {1,3}
 *   3. descrição do grupo do cliente contém "GROTT" (case-insensitive) → 3
 *   4. fallback → 1
 *
 * Nunca retorna null. Valores fora de {1,3} nunca escapam como válidos.
 *
 * Os módulos orders / operations / clients DEVEM delegar a esta função.
 */

const ALLOWED_COMPANY_IDS = Object.freeze([1, 3]);

const COMPANY_NAMES = Object.freeze({ 1: "Graal", 3: "Grott" });

/** Normaliza para 1 ou 3, ou null se o valor não pertencer ao domínio. */
function normalizeCompanyId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i === 1 || i === 3 ? i : null;
}

function isGrottGroup(groupDescription) {
  return typeof groupDescription === "string" && /grott/i.test(groupDescription);
}

/**
 * @param {{explicitCompanyId?: any, clientCompanyId?: any, groupDescription?: any}} input
 * @returns {1|3}
 */
function resolveCompanyId(input = {}) {
  const explicit = normalizeCompanyId(input.explicitCompanyId);
  if (explicit !== null) return explicit;
  const client = normalizeCompanyId(input.clientCompanyId);
  if (client !== null) return client;
  if (isGrottGroup(input.groupDescription)) return 3;
  return 1;
}

function companyName(companyId) {
  return COMPANY_NAMES[companyId] || null;
}

module.exports = {
  ALLOWED_COMPANY_IDS,
  COMPANY_NAMES,
  normalizeCompanyId,
  isGrottGroup,
  resolveCompanyId,
  companyName,
};
