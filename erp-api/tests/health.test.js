"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Stub do firebird-client ANTES do require do app, para não exigir Firebird real.
const path = require("path");
const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");
require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    executeQuery: async () => [{ OK: 1 }],
    ping: async () => true,
  },
};

const { createApp } = require("../src/app");
const { sign } = require("./helpers/sign");

const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

test("GET /api/v1/health responde 200 (público)", async () => {
  const app = createApp();
  const res = await request(app).get("/api/v1/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.service, "erp-api");
  assert.equal(res.body.data.status, "ok");
});

test("Rota inexistente retorna 404 padronizado", async () => {
  const app = createApp();
  const res = await request(app).get("/api/v1/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "NOT_FOUND");
  assert.equal(res.body.error.retryable, false);
});

test("JSON inválido retorna 400 INVALID_JSON", async () => {
  const app = createApp();
  const res = await request(app)
    .post("/api/v1/health")
    .set("Content-Type", "application/json")
    .send("{not json");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "INVALID_JSON");
});

test("/health/erp sem headers HMAC → 401 UNAUTHORIZED", async () => {
  const app = createApp();
  const res = await request(app).get("/api/v1/health/erp");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
  assert.equal(res.body.error.retryable, false);
});

test("/health/erp com assinatura inválida → 401", async () => {
  const app = createApp();
  const { headers } = sign({
    method: "GET",
    path: "/api/v1/health/erp",
    apiKey: API_KEY,
    secret: "outro-segredo-diferente-mas-do-tamanho-certo-xxxxx",
  });
  const res = await request(app).get("/api/v1/health/erp").set(headers);
  assert.equal(res.status, 401);
});

test("/health/erp com timestamp expirado → 401", async () => {
  const app = createApp();
  const { headers } = sign({
    method: "GET",
    path: "/api/v1/health/erp",
    apiKey: API_KEY,
    secret: HMAC_SECRET,
    timestamp: Date.now() - 10 * 60 * 1000, // 10 min no passado
  });
  const res = await request(app).get("/api/v1/health/erp").set(headers);
  assert.equal(res.status, 401);
});

test("/health/erp com assinatura válida → 200", async () => {
  const app = createApp();
  const { headers } = sign({
    method: "GET",
    path: "/api/v1/health/erp",
    apiKey: API_KEY,
    secret: HMAC_SECRET,
  });
  const res = await request(app).get("/api/v1/health/erp").set(headers);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.database, "reachable");
});

test("Nonce repetido é rejeitado (anti-replay)", async () => {
  const app = createApp();
  const first = sign({
    method: "GET",
    path: "/api/v1/health/erp",
    apiKey: API_KEY,
    secret: HMAC_SECRET,
  });
  const ok = await request(app).get("/api/v1/health/erp").set(first.headers);
  assert.equal(ok.status, 200);
  // Reenvia exatamente os mesmos headers → nonce já visto
  const replay = await request(app).get("/api/v1/health/erp").set(first.headers);
  assert.equal(replay.status, 401);
});

test("Bypass NÃO funciona em produção mesmo com DEV_BYPASS_AUTH=true", async () => {
  // Reset do módulo de env com NODE_ENV=production e bypass=true
  process.env.NODE_ENV = "production";
  process.env.DEV_BYPASS_AUTH = "true";
  // API_KEY e HMAC_SECRET já são longos o suficiente para produção
  const envPath = path.resolve(__dirname, "../src/config/env.js");
  delete require.cache[envPath];
  const { env } = require(envPath);
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.DEV_BYPASS_AUTH, false, "bypass deve ser forçado a false em produção");
  // Restaura para não afetar outros testes que rodem depois
  process.env.NODE_ENV = "development";
  process.env.DEV_BYPASS_AUTH = "false";
  delete require.cache[envPath];
});

test("Sem bypass, x-forwarded-for forjado NÃO abre acesso ao /health/erp", async () => {
  const app = createApp();
  const spoof = await request(app)
    .get("/api/v1/health/erp")
    .set("x-forwarded-for", "8.8.8.8")
    .set("x-real-ip", "8.8.8.8");
  // Sem HMAC e sem bypass real, sempre 401 — o check de bypass usa o socket,
  // não headers de proxy.
  assert.equal(spoof.status, 401);
});