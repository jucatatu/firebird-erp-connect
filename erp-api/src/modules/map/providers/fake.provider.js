"use strict";

const crypto = require("crypto");
const { stripAccents } = require("../geocoding-normalize");

/**
 * Provider fake para testes e desenvolvimento.
 *
 * Comportamento determinístico:
 *  - `latitude`/`longitude` derivadas de hash → estáveis por cacheKey.
 *  - Regras de comportamento por palavras-chave na string canônica
 *    (case-insensitive, sem acentos):
 *       "unresolved" → status ZERO_RESULTS
 *       "provider-error" → throw Error("provider_error")
 *       "usa-address" → country=US (dispara validação BR)
 *       "mismatch-city" → cidade retornada difere da consultada
 *       "approximate" → locationType=APPROXIMATE
 *       "geometric" → locationType=GEOMETRIC_CENTER
 *       "range" → locationType=RANGE_INTERPOLATED
 *       default → ROOFTOP
 *  - `latency`: atraso configurável para exercitar timeouts.
 *  - `overrides`: Map<cacheKey|canonical, result> para forçar respostas em testes.
 */
function createFakeProvider(opts = {}) {
  const latency = Math.max(0, opts.latency || 0);
  const overrides = opts.overrides || new Map();
  const calls = [];

  function hashCoords(seed) {
    const h = crypto.createHash("sha1").update(seed).digest();
    const lat = -33 + (h.readUInt32BE(0) / 0xffffffff) * 28; // -33..-5 (Brasil)
    const lng = -73 + (h.readUInt32BE(4) / 0xffffffff) * 39; // -73..-34
    return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
  }

  async function geocode({ canonical, cacheKey, fields }) {
    calls.push({ canonical, cacheKey });
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));

    if (overrides.has(cacheKey)) return overrides.get(cacheKey);
    if (overrides.has(canonical)) return overrides.get(canonical);

    const flat = stripAccents(canonical.toLowerCase());
    if (flat.includes("provider-error")) {
      throw new Error("provider_error");
    }
    if (flat.includes("unresolved")) {
      return { status: "ZERO_RESULTS" };
    }

    let locationType = "ROOFTOP";
    if (flat.includes("approximate")) locationType = "APPROXIMATE";
    else if (flat.includes("geometric")) locationType = "GEOMETRIC_CENTER";
    else if (flat.includes("range")) locationType = "RANGE_INTERPOLATED";

    const country = flat.includes("usa-address") ? "US" : "BR";
    const matchedCity = flat.includes("mismatch-city")
      ? "Cidade Divergente"
      : fields.city;
    const { latitude, longitude } = hashCoords(cacheKey);

    return {
      status: "OK",
      placeId: `place_${cacheKey.slice(0, 12)}`,
      latitude,
      longitude,
      locationType,
      matchedCountry: country,
      matchedState: fields.state,
      matchedCity,
      matchedPostalCode: fields.postalCode || "",
    };
  }

  return { name: "fake", geocode, _calls: calls };
}

module.exports = { createFakeProvider };
