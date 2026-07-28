"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = { columns: {}, types: [], queries: [], failNext: false };

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
      if (/FROM TIPO_EQUIPAMENTO te/i.test(sql)) {
        if (state.failNext) {
          state.failNext = false;
          throw new Error("driver blew up running SELECT ... FROM TIPO_EQUIPAMENTO te");
        }
        const limit = params[params.length - 1];
        return state.types.slice(0, limit);
      }
      return [];
    },
  },
};

const { createApp } = require("../src/app");
const repository = require("../src/modules/equipment-types/equipment-types.repository");
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
    TIPO_EQUIPAMENTO: ["ID_TIPO_EQUIPAMENTO", "DESCRICAO", "ATIVO", "DELETED"],
  };
  state.types = [
    { ID_TIPO_EQUIPAMENTO: 1, TIPO_DESCRICAO: "CHOPEIRA 2 TORNEIRAS", TIPO_ATIVO: 1 },
    { ID_TIPO_EQUIPAMENTO: 2, TIPO_DESCRICAO: "CILINDRO CO2", TIPO_ATIVO: 0 },
  ];
  state.queries = [];
  state.failNext = false;
  repository.resetSchemaCache();
}

test.beforeEach(reset);

test("GET /api/v1/equipment-types exige autenticação HMAC", async () => {
  const res = await request(app).get("/api/v1/equipment-types");
  assert.equal(res.status, 401);
});

test("listagem devolve catálogo com teto rígido e sem SELECT *", async () => {
  const res = await get("/api/v1/equipment-types");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.equipmentTypes.length, 2);
  const q = state.queries.filter((s) => /FROM TIPO_EQUIPAMENTO te/i.test(s.sql)).pop();
  assert.match(q.sql, /ROWS \?/);
  assert.ok(!/SELECT\s+\*/i.test(q.sql));
});

test("categoria operacional NÃO é inferida por heurística de descrição", async () => {
  const res = await get("/api/v1/equipment-types");
  for (const t of res.body.data.equipmentTypes) {
    assert.equal(t.category, null);
    assert.equal(t.returnable, null);
  }
});

test("filtro active usa somente coluna confirmada", async () => {
  const res = await get("/api/v1/equipment-types?active=true");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.equipmentTypes.length, 1);
  assert.equal(res.body.data.equipmentTypes[0].id, 1);
});

test("schema reduzido não quebra: campos ausentes viram null", async () => {
  state.columns = { TIPO_EQUIPAMENTO: ["ID_TIPO_EQUIPAMENTO"] };
  repository.resetSchemaCache();
  state.types = [{ ID_TIPO_EQUIPAMENTO: 1 }];
  const res = await get("/api/v1/equipment-types");
  assert.equal(res.status, 200);
  const item = res.body.data.equipmentTypes[0];
  assert.equal(item.description, null);
  assert.equal(item.active, null);
  assert.equal(item.code, null);
});

test("parâmetro desconhecido e limit inválido retornam 400", async () => {
  assert.equal((await get("/api/v1/equipment-types?foo=1")).status, 400);
  assert.equal((await get("/api/v1/equipment-types?limit=9999")).status, 400);
});

test("erro do banco nunca vaza SQL nem stack", async () => {
  state.failNext = true;
  const res = await get("/api/v1/equipment-types");
  assert.ok(res.status >= 500);
  const json = JSON.stringify(res.body);
  assert.ok(!/SELECT|FROM |te\.|driver blew up/i.test(json), json);
  assert.equal(res.body.error.code, "EQUIPMENT_TYPE_QUERY_FAILED");
});