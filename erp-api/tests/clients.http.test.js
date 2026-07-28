"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = { columns: {}, clients: [], phones: [], orderAddresses: [], queries: [], failNext: false };

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
      if (/FROM CONTATO/i.test(sql) && /DISTINCT/i.test(sql)) {
        return state.clients.map((c) => ({ ID_CLIENTE: c.ID_CLIENTE }));
      }
      if (/FROM CONTATO/i.test(sql)) return state.phones;
      if (/FROM ORDENS_VENDA/i.test(sql)) return state.orderAddresses;
      if (/FROM CLIENTES cl/i.test(sql)) {
        if (state.failNext) {
          state.failNext = false;
          throw new Error("driver blew up running SELECT ... FROM CLIENTES cl");
        }
        if (/cl\.ID_CLIENTE = \?/.test(sql)) {
          const id = params[0];
          return state.clients.filter((c) => c.ID_CLIENTE === id);
        }
        const limit = params[params.length - 1];
        return state.clients.slice(0, limit);
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const repository = require("../src/modules/clients/clients.repository");
const { sign } = require("./helpers/sign");

const app = createApp();
const API_KEY = process.env.API_KEY;
const SECRET = process.env.HMAC_SECRET;

function get(pathWithQuery) {
  const { headers } = sign({ method: "GET", path: pathWithQuery, apiKey: API_KEY, secret: SECRET });
  return request(app).get(pathWithQuery).set(headers);
}

function resetFull() {
  state.columns = {
    CLIENTES: ["ID_PESSOA", "ID_EMPRESA", "ID_GRUPO_CLIENTE", "ID_VENDEDOR", "ATIVO",
      "DELETED", "BLOQUEADO", "ID_CIDADE", "ID_BAIRRO", "ID_RUA", "ID_ESTADO", "NUMERO", "CEP"],
    PESSOAS: ["NOME", "APELIDO", "CPF", "CNPJ", "DELETED"],
    GRUPO_CLIENTE: ["DESCRICAO"],
  };
  state.clients = [
    { ID_CLIENTE: 1, CLIENTE_NOME: "JOSE DA SILVA", CPF: "12345678901", CLIENTE_ID_EMPRESA: 3, CIDADE: "JOINVILLE", CLIENTE_ATIVO: 1 },
    { ID_CLIENTE: 2, CLIENTE_NOME: "MARIA SOUZA", CNPJ: "12345678000199", CLIENTE_ID_EMPRESA: 1, CIDADE: "BLUMENAU", CLIENTE_ATIVO: 1 },
  ];
  state.phones = [{ ID_CLIENTE: 1, TELEFONE: "47999887766" }];
  state.orderAddresses = [];
  state.queries = [];
  state.failNext = false;
  repository.resetSchemaCache();
}

test.beforeEach(resetFull);

test("GET /api/v1/clients exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/clients?q=jose");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("GET /api/v1/clients/:id exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/clients/1");
  assert.equal(res.status, 401);
});

test("busca sem filtro retorna 400", async () => {
  const res = await get("/api/v1/clients");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("busca por nome retorna itens mascarados e paginação determinística", async () => {
  const res = await get("/api/v1/clients?q=jose&limit=2");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.clients.length, 2);
  const json = JSON.stringify(res.body);
  assert.ok(!json.includes("12345678901"));
  assert.ok(!json.includes("12345678000199"));
  assert.ok(!json.includes("47999887766"));
  assert.equal(res.body.data.nextCursor, "2");
  assert.match(res.body.data.clients[0].phoneMasked, /\*/);
});

test("cursor devolvido avança sem repetir nem pular registros", async () => {
  const first = await get("/api/v1/clients?q=jose&limit=2");
  const cursor = first.body.data.nextCursor;
  state.clients = [{ ID_CLIENTE: 3, CLIENTE_NOME: "ANA", CLIENTE_ID_EMPRESA: 1 }];
  const second = await get(`/api/v1/clients?q=jose&limit=2&cursor=${cursor}`);
  assert.equal(second.status, 200);
  const cursorQuery = state.queries.filter((q) => /cl\.ID_CLIENTE > \?/.test(q.sql)).pop();
  assert.ok(cursorQuery, "consulta deveria usar keyset");
  assert.ok(cursorQuery.params.includes(2));
  assert.equal(second.body.data.clients[0].id, 3);
});

test("filtro companyId=3 não altera a empresa do cadastro, apenas filtra", async () => {
  const res = await get("/api/v1/clients?q=jose&companyId=3");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.clients.length, 1);
  assert.equal(res.body.data.clients[0].companyId, 3);
});

test("busca por telefone usa consulta em lote (sem N+1)", async () => {
  const res = await get("/api/v1/clients?phone=47999887766");
  assert.equal(res.status, 200);
  const phoneQueries = state.queries.filter((q) => /FROM CONTATO/i.test(q.sql));
  assert.ok(phoneQueries.length <= 2, `esperado ≤2 consultas em CONTATO, obtido ${phoneQueries.length}`);
});

test("limite de resultados é respeitado e nunca varre a tabela inteira", async () => {
  await get("/api/v1/clients?q=jose&limit=5");
  const searchQuery = state.queries.filter((q) => /FROM CLIENTES cl/i.test(q.sql)).pop();
  assert.match(searchQuery.sql, /ROWS \?/);
  assert.equal(searchQuery.params[searchQuery.params.length - 1], 5);
});

test("detalhe retorna cliente existente com documento mascarado", async () => {
  const res = await get("/api/v1/clients/1");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, 1);
  assert.ok(res.body.data.documentMasked.includes("*"));
  assert.ok(!JSON.stringify(res.body).includes("12345678901"));
});

test("detalhe de cliente inexistente retorna 404 tipado", async () => {
  const res = await get("/api/v1/clients/999");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "CLIENT_NOT_FOUND");
  assert.equal(res.body.error.retryable, false);
});

test("schema reduzido não quebra: campos ausentes viram null", async () => {
  state.columns = { CLIENTES: ["ID_PESSOA"], PESSOAS: ["NOME"], GRUPO_CLIENTE: [] };
  repository.resetSchemaCache();
  state.clients = [{ ID_CLIENTE: 1, CLIENTE_NOME: "JOSE" }];
  const res = await get("/api/v1/clients?q=jose");
  assert.equal(res.status, 200);
  const item = res.body.data.clients[0];
  assert.equal(item.active, null);
  assert.equal(item.blocked, null);
  assert.equal(item.documentMasked, null);
  assert.equal(item.companyId, 1);
});

test("erro do banco nunca vaza SQL, tabela ou stack ao cliente", async () => {
  state.failNext = true;
  const res = await get("/api/v1/clients?q=jose");
  assert.ok(res.status >= 500);
  const json = JSON.stringify(res.body);
  assert.ok(!/SELECT/i.test(json), json);
  assert.ok(!/CLIENTES/i.test(json), json);
  assert.ok(!/stack|at Object/i.test(json), json);
  assert.equal(res.body.error.code, "CLIENT_QUERY_FAILED");
});
