"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

// Stub do firebird-client ANTES de carregar app/repository.
const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = {
  orders: [],
  items: [],
  equip: [],
  phones: [],
  failNext: false,
  queries: [],
};

require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async (sql, params) => {
      state.queries.push({ sql, params });
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
        return state.items.filter((r) => set.has(r.ID_ORDENS_VENDA));
      }
      if (/FROM EQUIP_ORDENS_VENDA/i.test(sql)) {
        const set = new Set(params);
        return state.equip.filter((r) => set.has(r.ID_ORDENS_VENDA));
      }
      if (/FROM CONTATO/i.test(sql)) {
        const set = new Set(params);
        return state.phones.filter((r) => set.has(r.ID_CLIENTE));
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const { sign } = require("./helpers/sign");

const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

function reset() {
  state.orders = [];
  state.items = [];
  state.equip = [];
  state.phones = [];
  state.failNext = false;
  state.queries = [];
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
  reset();
  const app = createApp();
  const res = await request(app).get("/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("date ausente → 400 VALIDATION_ERROR", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.ok(res.body.error.details.some((d) => d.field === "date"));
});

test("date formato inválido → 400", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=21/07/2026");
  assert.equal(res.status, 400);
});

test("data impossível (2026-02-30) → 400", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-02-30");
  assert.equal(res.status, 400);
});

test("companies não permitida → 400", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&companies=2",
  );
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d) => d.field === "companies"));
});

test("resposta vazia → 200 orders:[] com companies default", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.date, "2026-07-21");
  assert.deepEqual(res.body.data.companies, [1, 3]);
  assert.equal(res.body.data.count, 0);
  assert.deepEqual(res.body.data.orders, []);
});

test("query string faz parte da assinatura HMAC", async () => {
  reset();
  const app = createApp();
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

test("resposta completa: contrato novo, telefone priorizado, sem dedup, companyId resolvido", async () => {
  reset();
  state.orders = [
    {
      ID_ORDENS_VENDA: 500,
      N_PEDIDO: 4567,
      ID_CLIENTE: 100,
      DATA_PREV_ENTREGA: "2026-07-21",
      DATA_PREV_RETORNO: "2026-07-25",
      OBS: "Entregar após 14h",
      NUMERO: "100",
      COMPLEMENTO: "Sala 2",
      CLIENTE_NOME: "Cliente Um",
      CLIENTE_APELIDO: "Apelido Um",
      UF: "SC",
      CIDADE: "Jaraguá do Sul",
      BAIRRO: "Centro",
      RUA: "Rua Exemplo",
      STATUS_DESCRICAO: "Confirmado",
      ORDEM_ID_EMPRESA: 1,
      CLIENTE_ID_EMPRESA: 3,
    },
    {
      ID_ORDENS_VENDA: 501,
      N_PEDIDO: 4568,
      ID_CLIENTE: 101,
      DATA_PREV_ENTREGA: "2026-07-21",
      CLIENTE_NOME: null,
      CLIENTE_APELIDO: "Só Apelido",
      UF: "SC",
      CIDADE: "Corupá",
      BAIRRO: null,
      RUA: null,
      NUMERO: null,
      COMPLEMENTO: null,
      STATUS_DESCRICAO: "Confirmado",
    },
  ];
  state.items = [
    {
      ID_ORDENS_VENDA: 500,
      ID_PRODUTO: 10,
      PRODUTO: "Chopp Pilsen",
      QUANTIDADE: 2,
      VALOR_UNITARIO: 15.5,
      VALOR_TOTAL: 31,
    },
    // duplicata proposital — DEVE ser preservada
    {
      ID_ORDENS_VENDA: 500,
      ID_PRODUTO: 10,
      PRODUTO: "Chopp Pilsen",
      QUANTIDADE: 2,
      VALOR_UNITARIO: 15.5,
      VALOR_TOTAL: 31,
    },
  ];
  state.equip = [
    { ID_ORDENS_VENDA: 500, ID_TIPO_EQUIPAMENTO: 5, TIPO: "Chopeira", QUANTIDADE: 1 },
    { ID_ORDENS_VENDA: 500, ID_TIPO_EQUIPAMENTO: 5, TIPO: "Chopeira", QUANTIDADE: 1 },
  ];
  state.phones = [
    // ordem que o SQL entregaria: CELULAR primeiro
    { ID_CLIENTE: 100, TELEFONE: "47999999999", TIPO_CONTATO: "CELULAR" },
    { ID_CLIENTE: 100, TELEFONE: "4733334444", TIPO_CONTATO: "FONE" },
    // cliente 101 sem telefone
  ];

  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.equal(data.count, 2);

  const o1 = data.orders.find((o) => o.orderId === 500);
  assert.ok(o1);
  assert.equal(o1.orderNumber, "4567");
  assert.equal(typeof o1.orderNumber, "string");
  assert.equal(o1.clientId, 100);
  assert.equal(o1.clientName, "Cliente Um");
  assert.equal(o1.phone, "47999999999"); // CELULAR antes de FONE
  assert.equal(o1.expectedDelivery, "2026-07-21");
  assert.equal(o1.expectedReturn, "2026-07-25");
  assert.equal(o1.observations, "Entregar após 14h");
  assert.equal(o1.erpStatus, "Confirmado");
  assert.equal(o1.companyId, 1);
  assert.deepEqual(o1.address, {
    street: "Rua Exemplo",
    number: "100",
    complement: "Sala 2",
    neighborhood: "Centro",
    city: "Jaraguá do Sul",
    state: "SC",
  });
  assert.equal(o1.items.length, 2); // NÃO deduplicado
  assert.equal(o1.equipments.length, 2); // NÃO deduplicado

  const o2 = data.orders.find((o) => o.orderId === 501);
  assert.ok(o2);
  assert.equal(o2.clientName, "Só Apelido");
  assert.equal(o2.phone, null);
  assert.deepEqual(o2.items, []);
  assert.deepEqual(o2.equipments, []);
});

test("companies filtra pelo companyId resolvido (default Graal quando NULL sem GROTT)", async () => {
  reset();
  state.orders = [
    {
      ID_ORDENS_VENDA: 1,
      N_PEDIDO: 1,
      ID_CLIENTE: 1,
      DATA_PREV_ENTREGA: "2026-07-21",
      ORDEM_ID_EMPRESA: 1,
    },
    {
      ID_ORDENS_VENDA: 2,
      N_PEDIDO: 2,
      ID_CLIENTE: 2,
      DATA_PREV_ENTREGA: "2026-07-21",
      CLIENTE_ID_EMPRESA: 3,
    },
    {
      ID_ORDENS_VENDA: 3,
      N_PEDIDO: 3,
      ID_CLIENTE: 3,
      DATA_PREV_ENTREGA: "2026-07-21",
      GRUPO_CLIENTE_DESCRICAO: "PONTO DE VENDA - GROTT",
    },
    {
      ID_ORDENS_VENDA: 4,
      N_PEDIDO: 4,
      ID_CLIENTE: 4,
      DATA_PREV_ENTREGA: "2026-07-21",
      GRUPO_CLIENTE_DESCRICAO: "CLIENTES GERAIS",
    },
  ];
  const app = createApp();
  const res = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&companies=1",
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.companies, [1]);
  // Pedidos 1 (ORDEM=1) e 4 (default Graal por NULL sem GROTT) → empresa 1.
  assert.equal(res.body.data.count, 2);
  assert.deepEqual(
    res.body.data.orders.map((o) => o.orderId).sort((a, b) => a - b),
    [1, 4],
  );

  const res2 = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&companies=3",
  );
  const ids3 = res2.body.data.orders.map((o) => o.orderId).sort();
  assert.deepEqual(ids3, [2, 3]);

  const res3 = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&companies=1,3",
  );
  // Todos os 4 pedidos: 1 e 4 → Graal, 2 e 3 → Grott.
  assert.equal(res3.body.data.count, 4);

  // Sem filtro: retorna todos. Nenhum pedido pode ter companyId null.
  const res4 = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res4.body.data.count, 4);
  for (const o of res4.body.data.orders) {
    assert.ok(o.companyId === 1 || o.companyId === 3, `companyId inválido: ${o.companyId}`);
  }
});

test("alias legado `empresas` continua funcionando como `companies`", async () => {
  reset();
  state.orders = [
    {
      ID_ORDENS_VENDA: 10,
      N_PEDIDO: 10,
      ID_CLIENTE: 10,
      DATA_PREV_ENTREGA: "2026-07-21",
      ORDEM_ID_EMPRESA: 1,
    },
    {
      ID_ORDENS_VENDA: 11,
      N_PEDIDO: 11,
      ID_CLIENTE: 11,
      DATA_PREV_ENTREGA: "2026-07-21",
      ORDEM_ID_EMPRESA: 3,
    },
  ];
  const app = createApp();
  const res = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&empresas=3",
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.companies, [3]);
  assert.equal(res.body.data.count, 1);
  assert.equal(res.body.data.orders[0].orderId, 11);
});

test("query usa data convertida para MM/DD/YYYY e schema real (N_PEDIDO / DATA_PREV_ENTREGA)", async () => {
  reset();
  const app = createApp();
  await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  const ordersQuery = state.queries.find((q) => /FROM ORDENS_VENDA/i.test(q.sql));
  assert.ok(ordersQuery, "query base foi executada");
  assert.deepEqual(ordersQuery.params, ["07/21/2026"]);
  const sql = ordersQuery.sql;
  assert.ok(/N_PEDIDO/.test(sql));
  assert.ok(/ID_ORDENS_VENDA/.test(sql));
  assert.ok(/DATA_PREV_ENTREGA/.test(sql));
  assert.ok(/DATA_PREV_RETORNO/.test(sql));
  assert.ok(/\bOBS\b/.test(sql));
  assert.ok(/ENTREGAR = 1/.test(sql));
  assert.ok(/DELETED/.test(sql));
  assert.ok(/STATUS\s+s|s\.DESCRICAO/i.test(sql));
  assert.ok(!/OV\.NUMERO/i.test(sql) || /ov\.NUMERO/.test(sql));
  assert.ok(!/DT_ENTREGA/.test(sql));
  assert.ok(!/OBSERVACAO/.test(sql));
});

test("itens usam QTDE_PEDIDA / PRECO_UNIT / VALOR_ITEM e JOIN em ID_PRODUTOS", async () => {
  reset();
  state.orders = [{ ID_ORDENS_VENDA: 1, N_PEDIDO: 1, ID_CLIENTE: 1 }];
  const app = createApp();
  await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  const q = state.queries.find((x) => /FROM ITENS_ORDENS_VENDA/i.test(x.sql));
  assert.ok(q);
  assert.ok(/QTDE_PEDIDA/.test(q.sql));
  assert.ok(/PRECO_UNIT/.test(q.sql));
  assert.ok(/VALOR_ITEM/.test(q.sql));
  assert.ok(/ID_PRODUTOS/.test(q.sql));
  assert.ok(/DELETED/.test(q.sql));
});

test("equipamentos usam ID_TIPO_EQUIPAMENTO / QTDE / TIPO_EQUIPAMENTO.DESCRICAO", async () => {
  reset();
  state.orders = [{ ID_ORDENS_VENDA: 1, N_PEDIDO: 1, ID_CLIENTE: 1 }];
  const app = createApp();
  await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  const q = state.queries.find((x) => /FROM EQUIP_ORDENS_VENDA/i.test(x.sql));
  assert.ok(q);
  assert.ok(/ID_TIPO_EQUIPAMENTO/.test(q.sql));
  assert.ok(/\bQTDE\b/.test(q.sql));
  assert.ok(/TIPO_EQUIPAMENTO/.test(q.sql));
  assert.ok(!/ID_TIPO_EQUIP\b/.test(q.sql));
});

test("telefones usam CONTATO / TIPO_CONTATO com IN parametrizado", async () => {
  reset();
  state.orders = [
    { ID_ORDENS_VENDA: 1, N_PEDIDO: 1, ID_CLIENTE: 100 },
    { ID_ORDENS_VENDA: 2, N_PEDIDO: 2, ID_CLIENTE: 200 },
  ];
  const app = createApp();
  await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  const q = state.queries.find((x) => /FROM CONTATO/i.test(x.sql));
  assert.ok(q);
  assert.ok(/TIPO_CONTATO/.test(q.sql));
  assert.ok(/CELULAR/.test(q.sql));
  assert.ok(/FONE/.test(q.sql));
  // parametrizado — os IDs vão em params, não interpolados.
  assert.deepEqual(q.params, [100, 200]);
  assert.ok(/IN \(\?, \?\)/.test(q.sql));
});

test("erro do repository → 503 ERP_UNAVAILABLE sem vazar detalhes", async () => {
  reset();
  state.failNext = true;
  const app = createApp();
  const res = await signedGet(app, "/api/v1/operations/orders?date=2026-07-21");
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, "ERP_UNAVAILABLE");
  assert.ok(!/SELECT/i.test(res.body.error.message));
});

test("health retorna a versão do package.json (1.3.0)", async () => {
  reset();
  const app = createApp();
  const res = await request(app).get("/api/v1/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.version, "1.3.0");
});

test("contrato final contém date, companies, count e orders", async () => {
  reset();
  const app = createApp();
  const res = await signedGet(
    app,
    "/api/v1/operations/orders?date=2026-07-21&companies=1",
  );
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.ok("date" in data);
  assert.ok("companies" in data);
  assert.ok("count" in data);
  assert.ok(Array.isArray(data.orders));
});