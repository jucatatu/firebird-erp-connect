"use strict";

const crypto = require("crypto");

/**
 * Normalização de endereços para geocodificação.
 *
 * Objetivos:
 *  - Produzir uma string canônica ESTÁVEL para geocodificar.
 *  - Produzir um `cacheKey` determinístico (hash) para dedup persistente
 *    entre chamadas e entre processos.
 *  - Nunca depender de valor devolvido pelo provider (formatted_address).
 *
 * Regras:
 *  - trim + colapso de espaços em cada campo;
 *  - remoção de acentos, letras minúsculas para o hash;
 *  - a string canônica visível preserva capitalização original.
 */

function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normField(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/**
 * Constrói a string canônica de endereço.
 * Fields esperados: { street, number, complement, neighborhood, city, state, postalCode? }
 * Complement é intencionalmente EXCLUÍDO da chave (apto/sala não muda a coordenada).
 */
function buildCanonical(fields) {
  const parts = [];
  const streetLine = [normField(fields.street), normField(fields.number)]
    .filter(Boolean)
    .join(", ");
  if (streetLine) parts.push(streetLine);
  const neighborhood = normField(fields.neighborhood);
  if (neighborhood) parts.push(neighborhood);
  const cityState = [normField(fields.city), normField(fields.state)]
    .filter(Boolean)
    .join(" - ");
  if (cityState) parts.push(cityState);
  const cep = normField(fields.postalCode);
  if (cep) parts.push(`CEP ${cep}`);
  parts.push("Brasil");
  return parts.join(", ");
}

function isGeocodable(fields) {
  const city = normField(fields.city);
  const state = normField(fields.state);
  const street = normField(fields.street);
  // Precisa no mínimo cidade+estado OU rua+cidade para tentar.
  if (city && state) return true;
  if (street && city) return true;
  return false;
}

function computeCacheKey(fields) {
  const parts = [
    stripAccents(normField(fields.street)).toLowerCase(),
    stripAccents(normField(fields.number)).toLowerCase(),
    stripAccents(normField(fields.neighborhood)).toLowerCase(),
    stripAccents(normField(fields.city)).toLowerCase(),
    stripAccents(normField(fields.state)).toLowerCase(),
    stripAccents(normField(fields.postalCode)).toLowerCase(),
  ];
  const canonical = parts.join("|");
  return crypto.createHash("sha1").update(canonical).digest("hex");
}

/**
 * Retorna { cacheKey, canonical, geocodable, fields } — nunca lança.
 * Endereços não geocodáveis recebem cacheKey mesmo assim (para deduplicar
 * tentativas), mas com flag `geocodable=false`.
 */
function normalizeAddress(fields) {
  const canonical = buildCanonical(fields || {});
  const cacheKey = computeCacheKey(fields || {});
  return {
    cacheKey,
    canonical,
    geocodable: isGeocodable(fields || {}),
    fields: {
      street: normField(fields?.street),
      number: normField(fields?.number),
      complement: normField(fields?.complement),
      neighborhood: normField(fields?.neighborhood),
      city: normField(fields?.city),
      state: normField(fields?.state),
      postalCode: normField(fields?.postalCode),
    },
  };
}

module.exports = {
  normalizeAddress,
  buildCanonical,
  computeCacheKey,
  isGeocodable,
  stripAccents,
  normField,
};
