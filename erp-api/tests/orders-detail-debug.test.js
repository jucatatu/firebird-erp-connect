"use strict";

require("./helpers/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

// Desativar auth para testes de lógica
process.env.SKIP_AUTH_FOR_TEST = "true";


const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = {
  calls: [],
};

// Mock do Firebird Client
require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async (sql, params) => {
      state.calls.push({ sql, params });
      // Simular busca por N_PEDIDO 8623
      if (/WHERE ov.N_PEDIDO = \?/i.test(sql) && params[0] === 8623) {
        return [{
          ID_ORDENS_VENDA: 5000,
          N_PEDIDO: 8623,
          ID_EMPRESA: 1,
          ID_STATUS: 27,
          STATUS_DESCRICAO: 'PENDENTE'
        }];
      }
      // Simular busca de itens para o ID 5000
      if (/FROM ITENS_ORDENS_VENDA/i.test(sql) && params[0] === 5000) {
        return [{ ID_PRODUTO: 10, QTDE_PEDIDA: 2, PRECO_UNIT: 15.5 }];
      }
      // Simular busca de equipamentos para o ID 5000
      if (/FROM EQUIP_ORDENS_VENDA/i.test(sql) && params[0] === 5000) {
        return [{ ID_TIPO_EQUIPAMENTO: 5, QTDE: 1 }];
      }
      return [];
    },
    withTransaction: async (fn) => {
      const tx = {
        query: async (sql, params) => {
          state.calls.push({ sql, params });
          if (/WHERE ov.N_PEDIDO = \?/i.test(sql) && params[0] === 8623) {
             return [{ ID_ORDENS_VENDA: 5000, N_PEDIDO: 8623, ID_STATUS: 27 }];
          }
          return [];
        }
      };
      return fn(tx);
    }
  },
};

const { createApp } = require("../src/app");
const { sign } = require("./helpers/sign");

const API_KEY = process.env.API_KEY || 'test-key';
const HMAC_SECRET = process.env.HMAC_SECRET || 'test-secret';

test("GET /api/v1/orders/:orderNumber - debug logic", async (t) => {
  const app = createApp();
  const orderNumber = 8623;
  const path = `/api/v1/orders/${orderNumber}`;
  
  const headers = sign({
    method: 'GET',
    path,
    apiKey: API_KEY,
    secret: HMAC_SECRET
  });

  const res = await request(app)
    .get(path)
    .set(headers);

  console.log('[TEST DEBUG] Status:', res.status);
  console.log('[TEST DEBUG] Body:', JSON.stringify(res.body, null, 2));

  assert.strictEqual(res.status, 200, "Should return 200");
  assert.strictEqual(res.body.data.orderNumber, 8623);
  assert.strictEqual(res.body.data.orderId, 5000);
});

test("GET /api/v1/orders/:orderNumber - 404 case", async (t) => {
  const app = createApp();
  const orderNumber = 9999;
  const path = `/api/v1/orders/${orderNumber}`;
  
  const headers = sign({
    method: 'GET',
    path,
    apiKey: API_KEY,
    secret: HMAC_SECRET
  });

  const res = await request(app)
    .get(path)
    .set(headers);

  assert.strictEqual(res.status, 404, "Should return 404 for missing order");
});
