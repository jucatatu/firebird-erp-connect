"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAddress,
  computeCacheKey,
  isGeocodable,
} = require("../src/modules/map/geocoding-normalize");
const { createMemoryCache } = require("../src/modules/map/geocoding-cache");
const { createFakeProvider } = require("../src/modules/map/providers/fake.provider");
const geocoding = require("../src/modules/map/geocoding.service");

function addr(overrides = {}) {
  return {
    street: "Rua das Palmeiras",
    number: "100",
    complement: "",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    postalCode: "01000-000",
    ...overrides,
  };
}

test("cacheKey ignora complement e acentos", () => {
  const a = normalizeAddress(addr({ complement: "Apto 1" }));
  const b = normalizeAddress(addr({ complement: "Sala 999", city: "SAO PAULO" }));
  assert.equal(a.cacheKey, b.cacheKey);
});

test("cacheKey difere quando rua/numero mudam", () => {
  const a = computeCacheKey(addr());
  const b = computeCacheKey(addr({ number: "200" }));
  assert.notEqual(a, b);
});

test("isGeocodable exige mínimo de cidade+UF ou rua+cidade", () => {
  assert.equal(isGeocodable({}), false);
  assert.equal(isGeocodable({ city: "SP", state: "SP" }), true);
  assert.equal(isGeocodable({ street: "R X", city: "SP" }), true);
});

test("resolveOne persiste no cache e a segunda chamada é hit", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const r1 = await geocoding.resolveOne(addr(), provider, { cache });
  assert.equal(r1.status, "resolved");
  assert.equal(provider._calls.length, 1);
  const r2 = await geocoding.resolveOne(addr(), provider, { cache });
  assert.equal(r2.status, "resolved");
  assert.equal(provider._calls.length, 1, "não deve rechamar provider");
});

test("resolveOne classifica ZERO_RESULTS como unresolved", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua unresolved" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "unresolved");
  assert.equal(res.errorCode, "ZERO_RESULTS");
});

test("resolveOne isola exceção do provider como status=error", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua provider-error" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "error");
  assert.equal(res.errorCode, "PROVIDER_ERROR");
});

test("resolveOne rejeita país ≠ BR com NON_BR_RESULT", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua usa-address" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "unresolved");
  assert.equal(res.errorCode, "NON_BR_RESULT");
});

test("resolveOne rebaixa precisão em divergência de cidade", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua mismatch-city" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "resolved");
  assert.equal(res.matchMismatch, true);
  assert.equal(res.precision, "low");
});

test("resolveMany deduplica por cacheKey", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const list = [addr(), addr({ complement: "Sala 9" }), addr({ number: "200" })];
  const results = await geocoding.resolveMany(list, { provider, cache });
  // apenas 2 chaves distintas (complement é ignorado)
  assert.equal(results.size, 2);
  assert.equal(provider._calls.length, 2);
});

test("resolveMany respeita timeout global e marca pending", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider({ latency: 50 });
  const results = await geocoding.resolveMany([addr()], {
    provider,
    cache,
    timeoutMs: 5,
  });
  const only = results.get(normalizeAddress(addr()).cacheKey);
  assert.equal(only.status, "pending");
});

test("cache tryClaim bloqueia concorrência cross-request", async () => {
  const cache = createMemoryCache();
  assert.equal(await cache.tryClaim("k", 1000), true);
  assert.equal(await cache.tryClaim("k", 1000), false);
  await cache.releaseClaim("k");
  assert.equal(await cache.tryClaim("k", 1000), true);
});
