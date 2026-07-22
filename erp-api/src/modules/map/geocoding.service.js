"use strict";

const { env } = require("../../config/env");
const { logger } = require("../../config/logger");
const { normalizeAddress, stripAccents, normField } = require("./geocoding-normalize");
const { getCache } = require("./geocoding-cache");
const { createFakeProvider } = require("./providers/fake.provider");
const { createGoogleProvider } = require("./providers/google.provider");

/**
 * Serviço de geocodificação com:
 *  - dedup cross-request via claim persistente no cache;
 *  - dedup in-process via Map<key, Promise>;
 *  - timeout global por rodada;
 *  - falha isolada por endereço (uma exceção não derruba a rodada);
 *  - validação de país BR;
 *  - detecção de divergência cidade/UF (rebaixa precisão).
 *
 * NUNCA chamado pelo GET /map/orders (esse é read-only sobre o cache).
 * Apenas o POST /map/geocode dispara resoluções.
 */

// ── in-flight in-process ───────────────────────────────────────────────
const inflight = new Map(); // key -> Promise<result>

function precisionFromLocationType(lt) {
  switch (lt) {
    case "ROOFTOP":
      return "high";
    case "RANGE_INTERPOLATED":
      return "medium";
    case "GEOMETRIC_CENTER":
      return "low";
    case "APPROXIMATE":
    default:
      return "very_low";
  }
}

function sameText(a, b) {
  return stripAccents(String(a || "").toLowerCase()).trim() ===
    stripAccents(String(b || "").toLowerCase()).trim();
}

function detectMismatch({ requested, provider }) {
  const cityMismatch =
    normField(requested.city) &&
    normField(provider.matchedCity) &&
    !sameText(requested.city, provider.matchedCity);
  const stateMismatch =
    normField(requested.state) &&
    normField(provider.matchedState) &&
    !sameText(requested.state, provider.matchedState);
  return Boolean(cityMismatch || stateMismatch);
}

/** Registry: seleciona o provider a partir do env, salvo injeção explícita. */
function pickProvider(explicit) {
  if (explicit) return explicit;
  if (env.GEOCODING_PROVIDER === "google") return createGoogleProvider();
  return createFakeProvider();
}

/**
 * Resolve um único endereço.
 * Retorna sempre uma entrada com o campo `status`:
 *   'resolved'   → cache válido, coords disponíveis
 *   'unresolved' → provider disse que não há resultado
 *   'error'      → falha isolada
 *   'pending'    → outra requisição está resolvendo agora (claim ativo)
 *   'skipped'    → endereço não geocodável
 *
 * Nunca lança.
 */
async function resolveOne(fields, provider, opts = {}) {
  const cache = opts.cache || getCache();
  const norm = normalizeAddress(fields);

  // Dedup in-process.
  if (inflight.has(norm.cacheKey)) {
    try {
      return await inflight.get(norm.cacheKey);
    } catch (_e) {
      return { status: "error", cacheKey: norm.cacheKey };
    }
  }

  const promise = (async () => {
    // Hit direto no cache?
    const cached = await cache.get(norm.cacheKey);
    if (cached && (cached.status === "resolved" || cached.status === "unresolved")) {
      return cached;
    }

    if (!norm.geocodable) {
      const entry = {
        normalizedAddress: norm.canonical,
        placeId: "",
        latitude: null,
        longitude: null,
        locationType: "",
        precision: "",
        matchedCountry: "",
        matchedState: "",
        matchedCity: "",
        matchedPostalCode: "",
        matchMismatch: false,
        status: "skipped",
        errorCode: "NOT_GEOCODABLE",
        attempts: (cached && cached.attempts) || 0,
        lastProviderAt: null,
      };
      await cache.upsert(norm.cacheKey, entry);
      return { cacheKey: norm.cacheKey, ...entry };
    }

    // Claim cross-request.
    const acquired = await cache.tryClaim(norm.cacheKey, env.GEOCODING_INFLIGHT_TTL_MS);
    if (!acquired) {
      return {
        cacheKey: norm.cacheKey,
        status: "pending",
        normalizedAddress: norm.canonical,
      };
    }

    const attempts = ((cached && cached.attempts) || 0) + 1;
    try {
      const result = await provider.geocode({
        canonical: norm.canonical,
        cacheKey: norm.cacheKey,
        fields: norm.fields,
      });

      if (result.status === "ZERO_RESULTS") {
        const entry = {
          normalizedAddress: norm.canonical,
          placeId: "",
          latitude: null,
          longitude: null,
          locationType: "",
          precision: "",
          matchedCountry: "",
          matchedState: "",
          matchedCity: "",
          matchedPostalCode: "",
          matchMismatch: false,
          status: "unresolved",
          errorCode: "ZERO_RESULTS",
          attempts,
          lastProviderAt: Date.now(),
        };
        await cache.upsert(norm.cacheKey, entry);
        return { cacheKey: norm.cacheKey, ...entry };
      }

      // País ≠ BR → tratamos como unresolved e sinalizamos.
      if (result.matchedCountry && result.matchedCountry !== "BR") {
        const entry = {
          normalizedAddress: norm.canonical,
          placeId: result.placeId || "",
          latitude: null,
          longitude: null,
          locationType: result.locationType || "",
          precision: "",
          matchedCountry: result.matchedCountry,
          matchedState: result.matchedState || "",
          matchedCity: result.matchedCity || "",
          matchedPostalCode: result.matchedPostalCode || "",
          matchMismatch: true,
          status: "unresolved",
          errorCode: "NON_BR_RESULT",
          attempts,
          lastProviderAt: Date.now(),
        };
        await cache.upsert(norm.cacheKey, entry);
        return { cacheKey: norm.cacheKey, ...entry };
      }

      const mismatch = detectMismatch({
        requested: norm.fields,
        provider: result,
      });
      let precision = precisionFromLocationType(result.locationType);
      if (mismatch) precision = "low";

      // Coordenadas — cache in-memory por natureza; a política de persistência
      // futura será decidida por env.GEOCODING_PERSIST_COORDS.
      const entry = {
        normalizedAddress: norm.canonical,
        placeId: result.placeId || "",
        latitude: result.latitude,
        longitude: result.longitude,
        locationType: result.locationType || "APPROXIMATE",
        precision,
        matchedCountry: "BR",
        matchedState: result.matchedState || "",
        matchedCity: result.matchedCity || "",
        matchedPostalCode: result.matchedPostalCode || "",
        matchMismatch: mismatch,
        status: "resolved",
        errorCode: "",
        attempts,
        lastProviderAt: Date.now(),
      };
      await cache.upsert(norm.cacheKey, entry);
      return { cacheKey: norm.cacheKey, ...entry };
    } catch (err) {
      logger.warn(
        { cacheKey: norm.cacheKey, err: err && err.message },
        "geocoding provider error",
      );
      const entry = {
        normalizedAddress: norm.canonical,
        placeId: (cached && cached.placeId) || "",
        latitude: (cached && cached.latitude) ?? null,
        longitude: (cached && cached.longitude) ?? null,
        locationType: (cached && cached.locationType) || "",
        precision: "",
        matchedCountry: (cached && cached.matchedCountry) || "",
        matchedState: (cached && cached.matchedState) || "",
        matchedCity: (cached && cached.matchedCity) || "",
        matchedPostalCode: (cached && cached.matchedPostalCode) || "",
        matchMismatch: false,
        status: "error",
        errorCode: "PROVIDER_ERROR",
        attempts,
        lastProviderAt: Date.now(),
      };
      await cache.upsert(norm.cacheKey, entry);
      return { cacheKey: norm.cacheKey, ...entry };
    } finally {
      await cache.releaseClaim(norm.cacheKey);
    }
  })();

  inflight.set(norm.cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(norm.cacheKey) === promise) inflight.delete(norm.cacheKey);
  }
}

/**
 * Resolve uma lista de endereços com timeout global.
 * Retorna sempre um Map<cacheKey, result>. Endereços que não completaram
 * dentro do timeout ficam como { status: 'pending' }.
 */
async function resolveMany(fieldsList, opts = {}) {
  const provider = pickProvider(opts.provider);
  const timeoutMs = opts.timeoutMs || env.GEOCODING_GLOBAL_TIMEOUT_MS;
  const cache = opts.cache || getCache();

  // Dedup por cacheKey.
  const byKey = new Map();
  const orderedKeys = [];
  for (const f of fieldsList) {
    const n = normalizeAddress(f);
    if (!byKey.has(n.cacheKey)) {
      byKey.set(n.cacheKey, f);
      orderedKeys.push(n.cacheKey);
    }
  }

  const results = new Map();
  const timedOut = new Set(orderedKeys);
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(resolve, timeoutMs);
  });

  const work = orderedKeys.map(async (key) => {
    const res = await resolveOne(byKey.get(key), provider, { cache });
    results.set(key, res);
    timedOut.delete(key);
    return res;
  });

  await Promise.race([Promise.all(work), timeoutPromise]);
  clearTimeout(timeoutHandle);

  for (const key of timedOut) {
    if (!results.has(key)) {
      results.set(key, {
        cacheKey: key,
        status: "pending",
      });
    }
  }

  return results;
}

function _resetInflightForTests() {
  inflight.clear();
}

module.exports = {
  resolveOne,
  resolveMany,
  precisionFromLocationType,
  detectMismatch,
  pickProvider,
  _resetInflightForTests,
};
