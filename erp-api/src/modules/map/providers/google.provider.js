"use strict";

const { env } = require("../../../config/env");
const { logger } = require("../../../config/logger");

/**
 * Provider Google Geocoding — INERTE por padrão.
 *
 * Este arquivo existe apenas para deixar a interface pronta. Nenhuma
 * chamada real é feita enquanto env.GEOCODING_PROVIDER !== "google" e
 * env.GOOGLE_GEOCODING_API_KEY estiver vazia.
 *
 * Ao ativar:
 *  - Configurar GEOCODING_PROVIDER=google
 *  - Configurar GOOGLE_GEOCODING_API_KEY
 *  - Autorização explícita para consumo pago
 *
 * IMPORTANTE — política de armazenamento:
 *  Nunca persistir `formatted_address`. Apenas `place_id` é armazenado
 *  indefinidamente. Coordenadas seguem env.GEOCODING_PERSIST_COORDS.
 */
function createGoogleProvider(opts = {}) {
  const apiKey = opts.apiKey || env.GOOGLE_GEOCODING_API_KEY;
  const timeoutMs = opts.timeoutMs || env.GEOCODING_PROVIDER_TIMEOUT_MS;
  const fetchImpl = opts.fetch || globalThis.fetch;

  async function geocode({ canonical, fields }) {
    if (!apiKey) {
      throw new Error("google_geocoding_api_key_missing");
    }
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch_unavailable");
    }
    const params = new URLSearchParams({
      address: canonical,
      region: "br",
      language: "pt-BR",
      key: apiKey,
    });
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let json;
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }
    const status = json && json.status;
    if (status === "ZERO_RESULTS" || !json.results || json.results.length === 0) {
      return { status: "ZERO_RESULTS" };
    }
    if (status !== "OK") {
      logger.warn({ status }, "google geocoding non-ok status");
      throw new Error(`google_status_${status}`);
    }
    const first = json.results[0];
    const comps = Array.isArray(first.address_components) ? first.address_components : [];
    const findType = (t) =>
      (comps.find((c) => Array.isArray(c.types) && c.types.includes(t)) || {}).short_name ||
      "";
    const findLong = (t) =>
      (comps.find((c) => Array.isArray(c.types) && c.types.includes(t)) || {}).long_name ||
      "";
    return {
      status: "OK",
      placeId: first.place_id || "",
      // Coordenadas — persistência controlada pelo cache/env.
      latitude:
        first.geometry && first.geometry.location ? first.geometry.location.lat : null,
      longitude:
        first.geometry && first.geometry.location ? first.geometry.location.lng : null,
      locationType:
        (first.geometry && first.geometry.location_type) || "APPROXIMATE",
      matchedCountry: findType("country") || "",
      matchedState: findType("administrative_area_level_1") || "",
      matchedCity:
        findLong("administrative_area_level_2") ||
        findLong("locality") ||
        findLong("administrative_area_level_1") ||
        "",
      matchedPostalCode: findLong("postal_code") || "",
    };
  }

  return { name: "google", geocode };
}

module.exports = { createGoogleProvider };
