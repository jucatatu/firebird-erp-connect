"use strict";

const { env } = require("../../../config/env");
const { logger } = require("../../../config/logger");

/**
 * Provider Google Geocoding.
 *
 * Retorna sempre um objeto estruturado — nunca lança para erros conhecidos
 * (REQUEST_DENIED, timeout, rede). A service classifica como status="error"
 * preservando errorCode; nunca vira "pending" silenciosamente.
 *
 * IMPORTANTE — política de armazenamento:
 *  Nunca persistir `formatted_address`. Apenas `place_id` é armazenado
 *  indefinidamente. Coordenadas seguem env.GEOCODING_PERSIST_COORDS.
 *
 * NUNCA loga a URL (contém a API key). Somente metadados.
 */
function mapUpstreamStatus(status) {
  switch (status) {
    case "REQUEST_DENIED":
      return "REQUEST_DENIED";
    case "OVER_QUERY_LIMIT":
      return "OVER_QUERY_LIMIT";
    case "OVER_DAILY_LIMIT":
      return "OVER_DAILY_LIMIT";
    case "INVALID_REQUEST":
      return "INVALID_REQUEST";
    case "UNKNOWN_ERROR":
      return "UNKNOWN_ERROR";
    default:
      return "UPSTREAM_ERROR";
  }
}

function createGoogleProvider(opts = {}) {
  const apiKey = opts.apiKey || env.GOOGLE_GEOCODING_API_KEY;
  const timeoutMs = opts.timeoutMs || env.GEOCODING_PROVIDER_TIMEOUT_MS;
  const fetchImpl = opts.fetch || globalThis.fetch;

  async function geocode({ canonical }) {
    if (!apiKey) return { status: "ERROR", errorCode: "API_KEY_MISSING" };
    if (typeof fetchImpl !== "function") {
      return { status: "ERROR", errorCode: "FETCH_UNAVAILABLE" };
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
    const started = Date.now();
    let json;
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (!res.ok) {
        logger.warn(
          { httpStatus: res.status, latencyMs: Date.now() - started },
          "google geocoding http error",
        );
        return { status: "ERROR", errorCode: `HTTP_${res.status}` };
      }
      json = await res.json();
    } catch (err) {
      const isAbort = err && (err.name === "AbortError" || err.code === "ABORT_ERR");
      logger.warn(
        { errorName: err && err.name, latencyMs: Date.now() - started },
        isAbort ? "google geocoding timeout" : "google geocoding network error",
      );
      return {
        status: "ERROR",
        errorCode: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      };
    } finally {
      clearTimeout(timer);
    }
    const status = json && json.status;
    const resultsCount = Array.isArray(json && json.results) ? json.results.length : 0;
    logger.info(
      {
        upstreamStatus: status,
        resultsCount,
        hasErrorMessage: Boolean(json && json.error_message),
        latencyMs: Date.now() - started,
      },
      "google geocoding response",
    );
    if (status === "ZERO_RESULTS" || resultsCount === 0) {
      return { status: "ZERO_RESULTS" };
    }
    if (status !== "OK") {
      return { status: "ERROR", errorCode: mapUpstreamStatus(status) };
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

module.exports = { createGoogleProvider, mapUpstreamStatus };
