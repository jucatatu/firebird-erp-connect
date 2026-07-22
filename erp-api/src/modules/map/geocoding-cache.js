"use strict";

/**
 * Cache de geocodificação — implementação in-memory.
 *
 * Política de armazenamento (Google Geocoding ToS):
 *   Persistência permanente (permitida):
 *     - cache_key
 *     - normalized_address (string canônica NOSSA, não a do provider)
 *     - place_id (a API permite armazenamento indefinido de place_id)
 *     - location_type
 *     - matched_country / matched_state / matched_city / matched_postal_code
 *     - status, error_code, attempts, timestamps
 *
 *   Persistência NÃO validada contratualmente:
 *     - latitude / longitude
 *     - formatted_address do provider (NUNCA persistimos essa string)
 *
 *   Enquanto a validação contratual das coordenadas não é concluída, este
 *   cache é APENAS in-memory: coordenadas vivem no processo e desaparecem
 *   no restart. Uma implementação persistente futura DEVE seguir a mesma
 *   interface (get/upsert/tryClaim/releaseClaim) e respeitar o flag
 *   env.GEOCODING_PERSIST_COORDS para decidir se grava lat/lng.
 *
 * Interface:
 *   get(key)                     → entry | null
 *   upsert(key, entry)           → void
 *   tryClaim(key, ttlMs)         → boolean (true = adquirido, false = ocupado)
 *   releaseClaim(key)            → void
 *   getAll()                     → Array<entry>  (uso interno/testes)
 *   clear()                      → void          (uso interno/testes)
 */

function createMemoryCache() {
  const entries = new Map(); // key -> entry
  const claims = new Map(); // key -> expiresAt (ms)

  function isClaimActive(key, now) {
    const exp = claims.get(key);
    if (!exp) return false;
    if (exp <= now) {
      claims.delete(key);
      return false;
    }
    return true;
  }

  return {
    kind: "memory",
    async get(key) {
      return entries.get(key) || null;
    },
    async upsert(key, entry) {
      const now = Date.now();
      const existing = entries.get(key) || {};
      entries.set(key, {
        ...existing,
        ...entry,
        cacheKey: key,
        createdAt: existing.createdAt || now,
        updatedAt: now,
      });
    },
    async tryClaim(key, ttlMs) {
      const now = Date.now();
      if (isClaimActive(key, now)) return false;
      claims.set(key, now + ttlMs);
      return true;
    },
    async releaseClaim(key) {
      claims.delete(key);
    },
    async getAll() {
      return Array.from(entries.values());
    },
    async clear() {
      entries.clear();
      claims.clear();
    },
  };
}

let singleton = null;
function getCache() {
  if (!singleton) singleton = createMemoryCache();
  return singleton;
}

function _resetForTests() {
  singleton = null;
}

module.exports = { createMemoryCache, getCache, _resetForTests };
