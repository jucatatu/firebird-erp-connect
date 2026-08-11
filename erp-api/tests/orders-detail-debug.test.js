"use strict";

process.env.SKIP_AUTH_FOR_TEST = "true";
process.env.FIREBIRD_HOST = "localhost";
process.env.FIREBIRD_DATABASE = "test.fdb";
process.env.FIREBIRD_USER = "SYSDBA";
process.env.FIREBIRD_PASSWORD = "masterkey";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

// Mock ANTES de carregar o app
const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");
const firebirdMock = {
  ping: async () => true,
  executeQuery: async (sql, params) => {
    const q = sql.toUpperCase();
    if (q.includes('ORDENS_VENDA') && q.includes('N_PEDIDO = ?') && params[0] === 8623) {
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
        DATA_PREV_ENTREGA: new Date(),
        BUSCAR_EQUIP: 0,
        OBS: 'Teste'
      }];
    }
    if (q.includes('ITENS_ORDENS_VENDA') && params[0] === 5000) {
      return [{ ID_PRODUTO: 10, DESCRICAO: 'Produto 10', QTDE_PEDIDA: 2, PRECO_UNIT: 15.5 }];
    }
    if (q.includes('EQUIP_ORDENS_VENDA') && params[0] === 5000) {
      return [{ ID_TIPO_EQUIPAMENTO: 5, DESCRICAO: 'Equipamento 5', QTDE: 1 }];
    }
    return [];
  },
  withTransaction: async (fn) => fn({ query: firebirdMock.executeQuery })
};

require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: firebirdMock
};

const { createApp } = require("../src/app");

test("GET /api/v1/orders/:orderNumber - valid order", async (t) => {
  const app = createApp();
  const res = await request(app).get("/api/v1/orders/8623");

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.orderNumber, 8623);
  assert.strictEqual(res.body.data.orderId, 5000);
  assert.strictEqual(res.body.data.items.length, 1);
});

test("GET /api/v1/orders/:orderNumber - not found", async (t) => {
  const app = createApp();
  const res = await request(app).get("/api/v1/orders/9999");
  assert.strictEqual(res.status, 404);
});
