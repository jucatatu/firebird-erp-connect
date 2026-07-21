"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");
const crypto = require("crypto");

// Stub do firebird-client ANTES de carregar app/repository.
const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = {
  orders: [],
  items: [],
  equip: [],
  failNext: false,
  lastQueries: [],
};

require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async (sql, params) => {
      state.lastQueries.push({ sql, params });
      if (state.failNext) {
        state.failNext = false;
        const { AppError } = require("../src/shared/errors/app-error");
        throw new AppError({
          message: "ERP temporariamente indisponível.",
          statusCode: 503,
          code: "ERP_UNAVAILABLE",
          retryable: true,
        });
      }
      if (/FROM ORDENS_VENDA/i.test(sql)) return state.orders;
      if (/FROM ITENS_ORDENS_VENDA/i.test(sql)) {
        const set = new Set(params);
        return state.items.filter((r) => set.has(r.ORDER_ID));
      }
      if (/FROM EQUIP_ORDENS_VENDA/i.test(sql)) {
        const set = new Set(params);
        return state.equip.filter((r) => set.has(r.ORDER_ID));
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const { sign } = require("./helpers/sign");

const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

function resetState() {
  state.orders = [];
  state.items = [];
  state.equip = [];
  state.failNext = false;
  state.lastQueries = [];
}

function signedGet(app, urlPath) {
  const { headers } = sign({
    method: "GET",
    path: urlPath,
    apiKey: API_KEY,
    secret: HMAC_SECRET,
  });
  return request(app).get(urlPath).set(headers);
}

test("GET /operations/orders sem auth → 401", async () => {
  resetState();
  const app = createApp();
  const res = await request(app).get("/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("date ausente → 400 VALIDATION_ERROR com details", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.equal(res.body.error.retryable, false);
  assert.ok(Array.isArray(res.body.error.details));
  assert.ok(res.body.error.details.some((d) => d.field === "date"));
});

test("date com formato inválido → 400", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=21/07/2026");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("data impossível (2026-02-30) → 400", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-02-30");
  assert.equal(res.status, 400);
});

test("empresa não permitida → 400", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21&empresas=2");
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d) => d.field === "empresas"));
});

test("resposta vazia → 200 orders:[] com contrato completo", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.date, "2026-07-21");
  assert.deepEqual(res.body.data.empresas, [1, 3]);
  assert.equal(res.body.data.count, 0);
  assert.deepEqual(res.body.data.orders, []);
});

test("query string faz parte da assinatura HMAC", async () => {
  resetState();
  const app = createApp();
  // Assina um path e envia outro → deve falhar.
  const { headers } = sign({
    method: "GET",
    path: "/api/v1/operations/orders?date=2026-07-21",
    apiKey: API_KEY,
    secret: HMAC_SECRET,
  });
  const res = await request(app)
    .get("/api/v1/operations/orders?date=2026-07-22")
    .set(headers);
  assert.equal(res.status, 401);
});

test("resposta completa: pedido com itens e equipamentos deduplicados, filtrando empresas", async () => {
  resetState();
  state.orders = [
    // pedido 123 empresa 1 — deve entrar
    {
      ORDER_ID: 123, ORDER_NUMERO: 4567, ORDER_ID_EMPRESA: 1,
      ORDER_ID_STATUS: 2, ORDER_DT_ENTREGA: "2026-07-21",
      ORDER_OBSERVACAO: null, ORDER_ID_CLIENTE: 100,
      STATUS_NOME: "Confirmado   ",
      CLIENTE_ID: 100, CLIENTE_NOME_FANTASIA: null,
      CLIENTE_ID_GRUPO: null, CLIENTE_ID_PESSOA: 500,
      PESSOA_NOME: "Cliente Exemplo   ",
      CLI_ENDERECO: "Rua Exemplo", CLI_NUMERO_END: "100",
      CLI_COMPLEMENTO: null, BAIRRO_NOME: "Centro",
      CIDADE_NOME: "Jaraguá do Sul", ESTADO_UF: "SC",
      CLI_CEP: null, CLI_REFERENCIA: null, CLI_TELEFONE: "47999999999",
    },
    // pedido 124 empresa 3 — deve entrar quando empresas=[1,3]
    {
      ORDER_ID: 124, ORDER_NUMERO: 4568, ORDER_ID_EMPRESA: 3,
      ORDER_ID_STATUS: 2, ORDER_DT_ENTREGA: "2026-07-21",
      STATUS_NOME: "Confirmado",
      CLIENTE_ID: 101, PESSOA_NOME: "Outro",
    },
  ];
  state.items = [
    { ORDER_ID: 123, PRODUTO_ID: 10, PRODUTO_NOME: "Produto", QUANTIDADE: 2, UNIDADE: "UN" },
    // duplicata proposital
    { ORDER_ID: 123, PRODUTO_ID: 10, PRODUTO_NOME: "Produto", QUANTIDADE: 2, UNIDADE: "UN" },
  ];
  state.equip = [
    { ORDER_ID: 123, TIPO_ID: 5, TIPO_NOME: "Chopeira elétrica", QUANTIDADE: 1 },
    { ORDER_ID: 123, TIPO_ID: 5, TIPO_NOME: "Chopeira elétrica", QUANTIDADE: 1 },
  ];
  const app = createApp();

  // empresas=1 → só pedido 123
  const res1 = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21&empresas=1");
  assert.equal(res1.status, 200);
  assert.deepEqual(res1.body.data.empresas, [1]);
  assert.equal(res1.body.data.count, 1);
  assert.equal(res1.body.data.orders[0].id, 123);
  assert.equal(res1.body.data.orders[0].items.length, 1);
  assert.equal(res1.body.data.orders[0].equipment.length, 1);
  assert.equal(res1.body.data.orders[0].customer.name, "Cliente Exemplo");
  assert.equal(res1.body.data.orders[0].status.name, "Confirmado");
  assert.equal(res1.body.data.orders[0].delivery.date, "2026-07-21");

  // empresas default [1,3] → ambos
  const res2 = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res2.status, 200);
  assert.equal(res2.body.data.count, 2);
});

test("erro do repository é convertido em resposta segura (503 ERP_UNAVAILABLE)", async () => {
  resetState();
  state.failNext = true;
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, "ERP_UNAVAILABLE");
  assert.equal(res.body.error.retryable, true);
  // Nenhum detalhe interno vazado
  assert.equal(typeof res.body.error.message, "string");
  assert.ok(!/SELECT/i.test(res.body.error.message));
});

test("health continua retornando a versão do package.json (1.1.0)", async () => {
  resetState();
  const app = createApp();
  const res = await request(app).get("/api/v1/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.version, "1.1.0");
});

test("contrato final contém date, empresas, count e orders", async () => {
  resetState();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21&empresas=1");
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.ok("date" in data);
  assert.ok("empresas" in data);
  assert.ok("count" in data);
  assert.ok(Array.isArray(data.orders));
});

// Silencia warning de crypto import não utilizado em ambientes strict.
void crypto;