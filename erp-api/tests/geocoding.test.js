"use strict";

require("./helpers/env");

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
  assert.equal(r1.source, "provider", "primeira chamada = provider");
  assert.ok(r1.providerResolvedAt, "providerResolvedAt setado em resolved");
  assert.equal(provider._calls.length, 1);
  const r2 = await geocoding.resolveOne(addr(), provider, { cache });
  assert.equal(r2.status, "resolved");
  assert.equal(r2.source, "cache", "segunda chamada = cache (idempotente)");
  assert.equal(
    r2.providerResolvedAt,
    r1.providerResolvedAt,
    "providerResolvedAt preservado entre POSTs",
  );
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

test("provider retornando ERROR REQUEST_DENIED vira status=error (não pending)", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua request-denied" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "error");
  assert.equal(res.errorCode, "REQUEST_DENIED");
  // Persistido no cache com o mesmo status.
  const stored = await cache.get(res.cacheKey);
  assert.equal(stored.status, "error");
  assert.equal(stored.errorCode, "REQUEST_DENIED");
});

test("provider TIMEOUT vira status=error com errorCode=TIMEOUT", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();
  const provider = createFakeProvider();
  const res = await geocoding.resolveOne(
    addr({ street: "Rua provider-timeout" }),
    provider,
    { cache },
  );
  assert.equal(res.status, "error");
  assert.equal(res.errorCode, "TIMEOUT");
});

test("cacheKey do GET e do POST são idênticos para a mesma row", () => {
  // Simula a mesma cadeia usada em map.service tanto na leitura como
  // no POST: opsMapper.mapAddress produz {street, number, ...} e
  // normalizeAddress computa a cacheKey.
  const fields = {
    street: "Rua Osvaldo Maes",
    number: "30",
    complement: "",
    neighborhood: "Estrada Nova",
    city: "Jaraguá do Sul",
    state: "SC",
    postalCode: "",
  };
  const getSide = normalizeAddress(fields);
  const postSide = normalizeAddress({ ...fields, complement: "Sala 999" });
  assert.equal(getSide.cacheKey, postSide.cacheKey);
});

// ── Concorrência / single-flight ──────────────────────────────────────
// Simula duas requisições POST /api/v1/map/geocode concorrentes para o
// mesmo endereço. Cache inicialmente vazio.
//
// Requisitos validados aqui:
//   1) provider chamado exatamente 1 vez;
//   2) as duas respostas retornam com sucesso;
//   3) as duas apontam para o MESMO resultado (mesma cacheKey/lat/lng);
//   4) o cache termina como resolved;
//   5) uma chamada posterior retorna source="cache";
//   6) o mapa in-flight é liberado ao final (nada preso).
test("single-flight: duas chamadas concorrentes = 1 chamada ao provider", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();

  // Provider com latência para garantir sobreposição temporal.
  const provider = createFakeProvider({ latency: 25 });

  const [a, b] = await Promise.all([
    geocoding.resolveOne(addr(), provider, { cache }),
    geocoding.resolveOne(addr(), provider, { cache }),
  ]);

  assert.equal(provider._calls.length, 1, "provider chamado exatamente 1 vez");
  assert.equal(a.status, "resolved");
  assert.equal(b.status, "resolved");
  assert.equal(a.cacheKey, b.cacheKey, "mesma cacheKey");
  assert.equal(a.latitude, b.latitude, "mesma latitude");
  assert.equal(a.longitude, b.longitude, "mesma longitude");

  // Cache final = resolved.
  const stored = await cache.get(a.cacheKey);
  assert.equal(stored.status, "resolved");

  // Chamada posterior = source="cache".
  const later = await geocoding.resolveOne(addr(), provider, { cache });
  assert.equal(later.source, "cache");
  assert.equal(provider._calls.length, 1, "posterior não rechama provider");
});

// Falha durante concorrência: as duas requisições concorrentes recebem o
// mesmo status=error, o lock in-flight é removido, e uma tentativa
// posterior consegue chamar o provider novamente (nada de promise
// rejeitada presa no mapa).
test("single-flight: erro em chamada concorrente libera o lock", async () => {
  geocoding._resetInflightForTests();
  const cache = createMemoryCache();

  // Provider controlado: 1ª chamada throw, 2ª chamada sucesso.
  const calls = [];
  let call = 0;
  const provider = {
    name: "fake-controlled",
    _calls: calls,
    async geocode(input) {
      calls.push(input);
      call += 1;
      await new Promise((r) => setTimeout(r, 20));
      if (call === 1) throw new Error("boom");
      return {
        status: "OK",
        placeId: "p1",
        latitude: -23.5,
        longitude: -46.6,
        locationType: "ROOFTOP",
        matchedCountry: "BR",
        matchedState: input.fields.state,
        matchedCity: input.fields.city,
        matchedPostalCode: "",
      };
    },
  };

  const [a, b] = await Promise.all([
    geocoding.resolveOne(addr(), provider, { cache }),
    geocoding.resolveOne(addr(), provider, { cache }),
  ]);

  // Ambas resolvidas (não travadas) com o mesmo status=error.
  assert.equal(provider._calls.length, 1, "apenas 1 chamada apesar da falha");
  assert.equal(a.status, "error");
  assert.equal(b.status, "error");
  assert.equal(a.cacheKey, b.cacheKey);

  // Uma nova tentativa consegue chamar o provider novamente (nenhuma
  // promise rejeitada ficou presa no mapa in-flight).
  const retry = await geocoding.resolveOne(addr(), provider, { cache });
  assert.equal(provider._calls.length, 2, "retry chamou provider de novo");
  assert.equal(retry.status, "resolved");
  assert.equal(retry.source, "provider");
});
