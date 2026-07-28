"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = { columns: {}, products: [], queries: [], failNext: false };

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
      if (/FROM PRODUTOS pr/i.test(sql)) {
        if (state.failNext) {
          state.failNext = false;
          throw new Error("driver blew up running SELECT ... FROM PRODUTOS pr");
        }
        if (/pr\.\w+ = \?[\s\S]*ROWS 1/.test(sql)) {
          return state.products.filter((p) => p.ID_PRODUTO === params[0]);
        }
        const limit = params[params.length - 1];
        return state.products.slice(0, limit);
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const repository = require("../src/modules/products/products.repository");
const { sign } = require("./helpers/sign");

const app = createApp();
const API_KEY = process.env.API_KEY;
const SECRET = process.env.HMAC_SECRET;

function get(pathWithQuery) {
  const { headers } = sign({ method: "GET", path: pathWithQuery, apiKey: API_KEY, secret: SECRET });
  return request(app).get(pathWithQuery).set(headers);
}

function reset() {
  state.columns = {
    PRODUTOS: ["ID_PRODUTOS", "DESCRICAO", "CODIGO", "ID_GRUPO_PRODUTO", "ID_UNIDADE",
      "ID_EMPRESA", "DELETED", "ATIVO", "BLOQUEADO"],
    UNIDADE: ["ID_UNIDADE", "SIGLA", "DESCRICAO"],
    GRUPO_PRODUTO: ["ID_GRUPO_PRODUTO", "DESCRICAO"],
  };
  state.products = [
    {
      ID_PRODUTO: 10, PRODUTO_DESCRICAO: "CHOPP PILSEN 50L", PRODUTO_CODIGO: "CP50",
      ID_GRUPO_PRODUTO: 4, GRUPO_DESCRICAO: "CHOPP", ID_UNIDADE: 2, UNIDADE_CODIGO: "BR",
      UNIDADE_DESCRICAO: "BARRIL", PRODUTO_ID_EMPRESA: 3, PRODUTO_ATIVO: 1, PRODUTO_BLOQUEADO: 0,
    },
    {
      ID_PRODUTO: 11, PRODUTO_DESCRICAO: "CHOPP ESCURO 30L", PRODUTO_CODIGO: "CE30",
      ID_GRUPO_PRODUTO: 4, GRUPO_DESCRICAO: "CHOPP", ID_UNIDADE: 2, UNIDADE_CODIGO: "BR",
      UNIDADE_DESCRICAO: "BARRIL", PRODUTO_ID_EMPRESA: 1, PRODUTO_ATIVO: 0, PRODUTO_BLOQUEADO: 0,
    },
  ];
  state.queries = [];
  state.failNext = false;
  repository.resetSchemaCache();
}

test.beforeEach(reset);

test("GET /api/v1/products exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/products?q=chopp");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("GET /api/v1/products/:id exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/products/10");
  assert.equal(res.status, 401);
});

test("busca sem filtro retorna 400", async () => {
  const res = await get("/api/v1/products");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("q com menos de 3 caracteres retorna 400", async () => {
  const res = await get("/api/v1/products?q=ch");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("parâmetro desconhecido é rejeitado", async () => {
  const res = await get("/api/v1/products?q=chopp&preco=1");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("busca por descrição devolve contrato camelCase sem preço", async () => {
  const res = await get("/api/v1/products?q=chopp");
  assert.equal(res.status, 200);
  const item = res.body.data.products[0];
  assert.equal(item.id, 10);
  assert.equal(item.code, "CP50");
  assert.equal(item.description, "CHOPP PILSEN 50L");
  assert.equal(item.unit.code, "BR");
  assert.equal(item.group.description, "CHOPP");
  assert.equal(item.active, true);
  const json = JSON.stringify(res.body);
  assert.ok(!/preco|price|valor/i.test(json), json);
});

test("busca com acento e sem acento produz o mesmo padrão de folding", async () => {
  await get("/api/v1/products?q=eletrica");
  const semAcento = state.queries.filter((q) => /FROM PRODUTOS pr/i.test(q.sql)).pop();
  state.queries = [];
  await get(`/api/v1/products?q=${encodeURIComponent("elétrica")}`);
  const comAcento = state.queries.filter((q) => /FROM PRODUTOS pr/i.test(q.sql)).pop();
  assert.ok(semAcento.params.includes("%_L_TR_C_%"));
  assert.ok(comAcento.params.includes("%_L_TR_C_%"));
});

test("limite é respeitado e a consulta nunca varre a tabela inteira", async () => {
  await get("/api/v1/products?q=chopp&limit=5");
  const q = state.queries.filter((s) => /FROM PRODUTOS pr/i.test(s.sql)).pop();
  assert.match(q.sql, /ROWS \?/);
  assert.equal(q.params[q.params.length - 1], 5);
  assert.ok(!/SELECT\s+\*/i.test(q.sql));
});

test("limit acima do teto retorna 400", async () => {
  const res = await get("/api/v1/products?q=chopp&limit=500");
  assert.equal(res.status, 400);
});

test("cursor é opaco, avança keyset e não aceita valor forjado", async () => {
  const first = await get("/api/v1/products?q=chopp&limit=2");
  const cursor = first.body.data.nextCursor;
  assert.ok(cursor && !/^\d+$/.test(cursor), "cursor deve ser opaco");
  state.products = [{ ID_PRODUTO: 12, PRODUTO_DESCRICAO: "CHOPP IPA", PRODUTO_ATIVO: 1 }];
  const second = await get(`/api/v1/products?q=chopp&limit=2&cursor=${encodeURIComponent(cursor)}`);
  assert.equal(second.status, 200);
  const keyset = state.queries.filter((s) => /pr\.ID_PRODUTOS > \?/.test(s.sql)).pop();
  assert.ok(keyset, "consulta deveria usar keyset");
  assert.ok(keyset.params.includes(11));
  const forged = await get("/api/v1/products?q=chopp&cursor=nao-e-cursor!!");
  assert.equal(forged.status, 400);
});

test("filtro active usa apenas coluna confirmada", async () => {
  const res = await get("/api/v1/products?q=chopp&active=true");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.products.length, 1);
  assert.equal(res.body.data.products[0].id, 10);
});

test("schema reduzido não quebra: campos ausentes viram null", async () => {
  state.columns = { PRODUTOS: ["ID_PRODUTOS", "DESCRICAO"], UNIDADE: [], GRUPO_PRODUTO: [] };
  repository.resetSchemaCache();
  state.products = [{ ID_PRODUTO: 10, PRODUTO_DESCRICAO: "CHOPP" }];
  const res = await get("/api/v1/products?q=chopp");
  assert.equal(res.status, 200);
  const item = res.body.data.products[0];
  assert.equal(item.code, null);
  assert.equal(item.active, null);
  assert.equal(item.blocked, null);
  assert.equal(item.unit, null);
  assert.equal(item.group, null);
  assert.equal(item.companyId, null);
});

test("companyId sem coluna estruturada devolve 400 explícito", async () => {
  state.columns = { PRODUTOS: ["ID_PRODUTOS", "DESCRICAO"], UNIDADE: [], GRUPO_PRODUTO: [] };
  repository.resetSchemaCache();
  const res = await get("/api/v1/products?q=chopp&companyId=3");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("detalhe existente e inexistente", async () => {
  const ok = await get("/api/v1/products/10");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.id, 10);
  const missing = await get("/api/v1/products/999");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "PRODUCT_NOT_FOUND");
  assert.equal(missing.body.error.retryable, false);
});

test("erro do banco nunca vaza SQL, tabela ou stack", async () => {
  state.failNext = true;
  const res = await get("/api/v1/products?q=chopp");
  assert.ok(res.status >= 500);
  const json = JSON.stringify(res.body);
  assert.ok(!/SELECT|FROM |pr\.|driver blew up/i.test(json), json);
  assert.ok(!/stack|at Object/i.test(json), json);
  assert.equal(res.body.error.code, "PRODUCT_QUERY_FAILED");
});

test("aspas simples no termo não quebram nem injetam SQL", async () => {
  const res = await get(`/api/v1/products?q=${encodeURIComponent("chopp' OR 1=1 --")}`);
  assert.equal(res.status, 200);
  const q = state.queries.filter((s) => /FROM PRODUTOS pr/i.test(s.sql)).pop();
  assert.ok(!/OR 1=1/i.test(q.sql), q.sql);
  assert.ok(q.params.some((p) => String(p).includes("OR 1=1")));
});