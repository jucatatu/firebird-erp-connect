"use strict";

// Desativar auth para testes de lógica ANTES de qualquer require que use env
process.env.SKIP_AUTH_FOR_TEST = "true";
process.env.API_KEY = "test-key-16-chars-min";
process.env.HMAC_SECRET = "test-secret-32-chars-minimum-length";
process.env.FIREBIRD_HOST = "localhost";
process.env.FIREBIRD_DATABASE = "test.fdb";
process.env.FIREBIRD_USER = "SYSDBA";
process.env.FIREBIRD_PASSWORD = "masterkey";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

// Mock do Firebird Client
require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async (sql, params) => {
      // console.log('[MOCK executeQuery] SQL:', sql, 'Params:', params);
      // Simular busca por N_PEDIDO 8623
      if (/WHERE ov.N_PEDIDO = \?/i.test(sql) && params[0] === 8623) {
        return [{
          ID_ORDENS_VENDA: 5000,
          N_PEDIDO: 8623,
          ID_EMPRESA: 1,
          ID_CLIENTE: 100,
          ID_VENDEDOR: 2,
          ID_STATUS: 27,
          STATUS_DESCRICAO: 'PENDENTE',
          ID_TIPO_VENDA: 1,
          ID_PRAZO: 1,
          ID_FORMA_PAGAMENTO: 1,
          ENTREGAR: 1,
          DATA_PREV_ENTREGA: '2026-08-20',
          BUSCAR_EQUIP: 0,
          OBS: 'Teste de observação'
        }];
      }
      // Simular busca de itens para o ID 5000
      if (/FROM ITENS_ORDENS_VENDA/i.test(sql) && params[0] === 5000) {
        return [{ ID_PRODUTO: 10, DESCRICAO: 'Produto 10', QTDE_PEDIDA: 2, PRECO_UNIT: 15.5 }];
      }
      // Simular busca de equipamentos para o ID 5000
      if (/FROM EQUIP_ORDENS_VENDA/i.test(sql) && params[0] === 5000) {
        return [{ ID_TIPO_EQUIPAMENTO: 5, DESCRICAO: 'Equipamento 5', QTDE: 1 }];
      }
      return [];
    },
    withTransaction: async (fn) => {
      const tx = {
        query: async (sql, params) => {
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

test("GET /api/v1/orders/:orderNumber - debug logic", async (t) => {
  const app = createApp();
  const orderNumber = 8623;
  const path = `/api/v1/orders/${orderNumber}`;
  
  const res = await request(app)
    .get(path);

  // console.log('[TEST DEBUG] Status:', res.status);
  // console.log('[TEST DEBUG] Body:', JSON.stringify(res.body, null, 2));

  assert.strictEqual(res.status, 200, "Should return 200");
  assert.strictEqual(res.body.data.orderNumber, 8623);
  assert.strictEqual(res.body.data.orderId, 5000);
  assert.strictEqual(res.body.data.statusDescription, 'PENDENTE');
  assert.strictEqual(res.body.data.items.length, 1);
  assert.strictEqual(res.body.data.items[0].productId, 10);
});

test("GET /api/v1/orders/:orderNumber - 404 case", async (t) => {
  const app = createApp();
  const orderNumber = 9999;
  const path = `/api/v1/orders/${orderNumber}`;
  
  const res = await request(app)
    .get(path);

  assert.strictEqual(res.status, 404, "Should return 404 for missing order");
});
