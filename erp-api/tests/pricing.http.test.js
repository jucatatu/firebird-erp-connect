"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = { columns: {}, prices: [], queries: [], failNext: false };

function matches(row, where) {
  return Object.entries(where).every(([k, v]) => {
    if (v === null) return row[k] === null || row[k] === undefined;
    return row[k] === v;
  });
}

function sortRows(rows) {
  return rows
    .slice()
    .sort(
      (a, b) =>
        String(b.DATE_UPDATE || "").localeCompare(String(a.DATE_UPDATE || "")) ||
        b.ID_PRECO - a.ID_PRECO,
    );
}

require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async (sql, params) => {
      state.queries.push({ sql, params });
      if (/RDB\$RELATION_FIELDS/i.test(sql)) {
        const table = String(params[0]).toUpperCase();
        return (state.columns[table] || []).map((f) => ({ FIELD: f }));
      }
      if (/FROM PRECO p/i.test(sql)) {
        if (state.failNext) {
          state.failNext = false;
          throw new Error("driver blew up running SELECT ... FROM PRECO p");
        }
        const isSpecific = /p\.ID_CLIENTE = \?/.test(sql);
        const rows = state.prices.filter((r) => {
          if (r.DELETED) return false;
          if (isSpecific) {
            return matches(r, { ID_PRODUTO: params[0], ID_CLIENTE: params[1] });
          }
          return matches(r, {
            ID_PRODUTO: params[0],
            ID_CLIENTE: null,
            ID_GRUPO_CLIENTE: null,
          });
        });
        return sortRows(rows).slice(0, 1);
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const repository = require("../src/modules/pricing/pricing.repository");
const { sign } = require("./helpers/sign");

const app = createApp();

function get(pathWithQuery) {
  const { headers } = sign({
    method: "GET",
    path: pathWithQuery,
    apiKey: process.env.API_KEY,
    secret: process.env.HMAC_SECRET,
  });
  return request(app).get(pathWithQuery).set(headers);
}

function reset() {
  state.columns = {
    PRECO: [
      "ID_PRECO",
      "ID_PRODUTO",
      "ID_CLIENTE",
      "ID_GRUPO_CLIENTE",
      "VALOR",
      "DELETED",
      "DATE_UPDATE",
    ],
  };
  state.prices = [
    // preço padrão do produto 10
    {
      ID_PRECO: 81,
      ID_PRODUTO: 10,
      ID_CLIENTE: null,
      ID_GRUPO_CLIENTE: null,
      VALOR: 24.9,
      DELETED: 0,
      DATE_UPDATE: "2026-01-01",
    },
    // preço específico do cliente 500 (mais recente vence)
    {
      ID_PRECO: 140,
      ID_PRODUTO: 10,
      ID_CLIENTE: 500,
      ID_GRUPO_CLIENTE: null,
      VALOR: 31.0,
      DELETED: 0,
      DATE_UPDATE: "2026-01-02",
    },
    {
      ID_PRECO: 152,
      ID_PRODUTO: 10,
      ID_CLIENTE: 500,
      ID_GRUPO_CLIENTE: null,
      VALOR: 28.9,
      DELETED: 0,
      DATE_UPDATE: "2026-05-10",
    },
    // preço específico logicamente excluído
    {
      ID_PRECO: 200,
      ID_PRODUTO: 10,
      ID_CLIENTE: 900,
      ID_GRUPO_CLIENTE: null,
      VALOR: 9.9,
      DELETED: 1,
      DATE_UPDATE: "2026-06-01",
    },
    // preço de grupo NUNCA deve ser usado nesta sprint
    {
      ID_PRECO: 300,
      ID_PRODUTO: 20,
      ID_CLIENTE: null,
      ID_GRUPO_CLIENTE: 7,
      VALOR: 15.0,
      DELETED: 0,
      DATE_UPDATE: "2026-06-02",
    },
  ];
  state.queries = [];
  state.failNext = false;
  repository.resetSchemaCache();
}

test.beforeEach(reset);

test("GET /api/v1/pricing/resolve exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/pricing/resolve?productId=10");
  assert.equal(res.status, 401);
});

test("preço específico do cliente é encontrado e vence o padrão", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=10&clientId=500");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, {
    priceFound: true,
    unitPrice: 28.9,
    priceId: 152,
    strategy: "client_specific",
  });
});

test("fallback para preço padrão quando não há preço específico", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=10&clientId=777");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, {
    priceFound: true,
    unitPrice: 24.9,
    priceId: 81,
    strategy: "default_price",
  });
});

test("sem clientId resolve direto o preço padrão e não consulta cliente", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=10");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.strategy, "default_price");
  const priceQueries = state.queries.filter((q) => /FROM PRECO p/i.test(q.sql));
  assert.equal(priceQueries.length, 1);
  assert.ok(!/p\.ID_CLIENTE = \?/.test(priceQueries[0].sql));
});

test("cliente inexistente cai no preço padrão (nunca erro 404)", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=10&clientId=999999");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.priceFound, true);
  assert.equal(res.body.data.strategy, "default_price");
});

test("produto sem preço devolve priceFound=false, nunca zero", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=20&clientId=500");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { priceFound: false });
  assert.equal(res.body.data.unitPrice, undefined);
});

test("produto inexistente devolve priceFound=false", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=987654");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { priceFound: false });
});

test("preço logicamente excluído é ignorado", async () => {
  const res = await get("/api/v1/pricing/resolve?productId=10&clientId=900");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.strategy, "default_price");
  assert.equal(res.body.data.priceId, 81);
});

test("parâmetros inválidos retornam 400", async () => {
  assert.equal((await get("/api/v1/pricing/resolve")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=0")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=-3")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=1.5")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=abc")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=10&clientId=0")).status, 400);
  assert.equal((await get("/api/v1/pricing/resolve?productId=10&groupId=7")).status, 400);
});

test("tentativa de SQL Injection é rejeitada e nunca chega ao banco", async () => {
  const payloads = [
    "1%20OR%201%3D1",
    "1%3B%20DROP%20TABLE%20PRECO",
    "1'%20--",
    "1%20UNION%20SELECT%20VALOR%20FROM%20PRECO",
  ];
  for (const p of payloads) {
    // eslint-disable-next-line no-await-in-loop
    const res = await get(`/api/v1/pricing/resolve?productId=${p}`);
    assert.equal(res.status, 400, p);
  }
  assert.equal(state.queries.filter((q) => /FROM PRECO p/i.test(q.sql)).length, 0);
});

test("consulta é sempre parametrizada e sem SELECT *", async () => {
  await get("/api/v1/pricing/resolve?productId=10&clientId=500");
  const q = state.queries.filter((s) => /FROM PRECO p/i.test(s.sql)).pop();
  assert.match(q.sql, /SELECT FIRST 1/);
  assert.ok(!/SELECT\s+\*/i.test(q.sql));
  assert.deepEqual(q.params, [10, 500]);
});

test("erro de comunicação com o Firebird nunca vaza SQL nem stack", async () => {
  state.failNext = true;
  const res = await get("/api/v1/pricing/resolve?productId=10");
  assert.ok(res.status >= 500);
  const json = JSON.stringify(res.body);
  assert.ok(!/SELECT|FROM |p\.|driver blew up/i.test(json), json);
  assert.equal(res.body.error.code, "PRICE_QUERY_FAILED");
});

test("nenhuma escrita é enviada ao Firebird", async () => {
  await get("/api/v1/pricing/resolve?productId=10&clientId=500");
  for (const q of state.queries) {
    assert.ok(
      !/\b(INSERT|UPDATE|DELETE|MERGE|EXECUTE\s+PROCEDURE|CREATE|ALTER|DROP)\b/i.test(q.sql),
      q.sql,
    );
  }
});