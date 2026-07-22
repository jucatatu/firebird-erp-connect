"use strict";

require("./helpers/env");
process.env.IDEMPOTENCY_STORE = "memory";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

const clientPath = path.resolve(__dirname, "../src/shared/database/firebird-client.js");

const state = {
  createdOrderId: 999,
  createdOrderNumber: 12345,
  createdCompanyId: 1,
  createdStatus: "LIBERADO",
  clientContext: { CLIENTE_ID_EMPRESA: null, GRUPO_DESCRICAO: null },
  calls: [],
  failOnItemIndex: null,
  failOnEquipIndex: null,
  itemCallCount: 0,
  equipCallCount: 0,
  commits: 0,
  rollbacks: 0,
};

function txQuery(sql, params) {
  state.calls.push({ sql, params });
  if (/FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(sql)) {
    return [{ ID: state.createdOrderId }];
  }
  if (/FROM SP_CAD_ITENS_ORDENS_VENDA/i.test(sql)) {
    const idx = state.itemCallCount++;
    if (state.failOnItemIndex === idx) {
      const err = new Error("simulated item failure");
      err.code = "SIMULATED";
      throw err;
    }
    return [{ ID: 1 }];
  }
  if (/FROM SP_CAD_EQUIP_ORDENS_VENDA/i.test(sql)) {
    const idx = state.equipCallCount++;
    if (state.failOnEquipIndex === idx) {
      throw Object.assign(new Error("simulated equip failure"), { code: "SIMULATED" });
    }
    return [{ OK: 1 }];
  }
  if (/FROM ORDENS_VENDA\b/i.test(sql)) {
    return [
      {
        ID_ORDENS_VENDA: state.createdOrderId,
        N_PEDIDO: state.createdOrderNumber,
        ID_EMPRESA: state.createdCompanyId,
        STATUS_DESCRICAO: state.createdStatus,
      },
    ];
  }
  if (/FROM CLIENTES cl/i.test(sql)) {
    return [state.clientContext];
  }
  return [];
}

require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    ping: async () => true,
    executeQuery: async () => [],
    withTransaction: async (fn) => {
      const tx = { query: async (sql, params) => txQuery(sql, params || []) };
      try {
        const r = await fn(tx);
        state.commits++;
        return r;
      } catch (err) {
        state.rollbacks++;
        throw err;
      }
    },
  },
};

const { createApp } = require("../src/app");
const { sign } = require("./helpers/sign");
const { _resetForTests } = require("../src/shared/idempotency/idempotency-store");

const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

function payload(overrides = {}) {
  return {
    customerId: 100,
    companyId: 1,
    sellerId: 10,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    delivery: true,
    expectedDeliveryAt: "2026-07-25T14:00:00.000Z",
    deliveryAt: null,
    retrieveEquipment: false,
    returnAt: null,
    expectedReturnAt: null,
    total: 31,
    freight: 0,
    address: {
      state: "SC",
      city: "Jaragua do Sul",
      district: "Centro",
      street: "Rua A",
      number: "100",
      complement: null,
      postalCode: "89250000",
    },
    notes: null,
    stockOutput: false,
    userId: 5,
    carrierId: null,
    carrierVehicleId: null,
    commercialDiscountPercent: 0,
    posSessionId: null,
    items: [{ productId: 10, unitPrice: 15.5, quantity: 2, discount: 0 }],
    equipment: [{ equipmentTypeId: 5, productId: null, quantity: 1 }],
    ...overrides,
  };
}

function signedPost(app, urlPath, body, headers = {}) {
  const { headers: sig } = sign({
    method: "POST",
    path: urlPath,
    body,
    apiKey: API_KEY,
    secret: HMAC_SECRET,
  });
  return request(app)
    .post(urlPath)
    .set({ ...sig, ...headers })
    .set("Content-Type", "application/json")
    .send(body);
}

function reset() {
  state.calls = [];
  state.itemCallCount = 0;
  state.equipCallCount = 0;
  state.commits = 0;
  state.rollbacks = 0;
  state.failOnItemIndex = null;
  state.failOnEquipIndex = null;
  state.clientContext = { CLIENTE_ID_EMPRESA: null, GRUPO_DESCRICAO: null };
  _resetForTests();
}

test("POST orders sem auth 401", async () => {
  reset();
  const app = createApp();
  const res = await request(app)
    .post("/api/v1/orders")
    .set("Content-Type", "application/json")
    .send(payload());
  assert.equal(res.status, 401);
});

test("POST orders sem Idempotency-Key 400", async () => {
  reset();
  const app = createApp();
  const res = await signedPost(app, "/api/v1/orders", payload());
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "IDEMPOTENCY_KEY_REQUIRED");
});

test("payload invalido 400 VALIDATION_ERROR", async () => {
  reset();
  const app = createApp();
  const res = await signedPost(
    app,
    "/api/v1/orders",
    payload({ items: [] }),
    { "idempotency-key": "test-1" },
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("sucesso 201 com id orderNumber companyId status; GERA_COBRANCA=1 nas procs", async () => {
  reset();
  const app = createApp();
  const res = await signedPost(app, "/api/v1/orders", payload(), {
    "idempotency-key": "ok-1",
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.order.id, 999);
  assert.equal(res.body.order.orderNumber, 12345);
  assert.equal(res.body.order.companyId, 1);
  assert.equal(res.body.order.status, "LIBERADO");
  const completeCall = state.calls.find((c) =>
    /FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(c.sql),
  );
  assert.ok(completeCall);
  assert.equal(completeCall.params.length, 30);
  assert.equal(completeCall.params[22], 1);
  assert.equal(completeCall.params[25], null);
  const itemCall = state.calls.find((c) =>
    /FROM SP_CAD_ITENS_ORDENS_VENDA/i.test(c.sql),
  );
  assert.equal(itemCall.params[5], "I");
  const eqCall = state.calls.find((c) =>
    /FROM SP_CAD_EQUIP_ORDENS_VENDA/i.test(c.sql),
  );
  assert.equal(eqCall.params[4], "I");
  assert.equal(state.commits, 1);
  assert.equal(state.rollbacks, 0);
});

test("mesma Idempotency-Key + mesmo payload replay sem chamar procs", async () => {
  reset();
  const app = createApp();
  await signedPost(app, "/api/v1/orders", payload(), {
    "idempotency-key": "repeat-1",
  });
  const callsBefore = state.calls.length;
  const res = await signedPost(app, "/api/v1/orders", payload(), {
    "idempotency-key": "repeat-1",
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers["idempotent-replay"], "true");
  assert.equal(state.calls.length, callsBefore);
});

test("mesma Idempotency-Key + payload diferente 409", async () => {
  reset();
  const app = createApp();
  await signedPost(app, "/api/v1/orders", payload(), {
    "idempotency-key": "conflict-1",
  });
  const res = await signedPost(
    app,
    "/api/v1/orders",
    payload({
      freight: 10,
      total: 62,
      items: [{ productId: 10, unitPrice: 31, quantity: 2, discount: 0 }],
    }),
    { "idempotency-key": "conflict-1" },
  );
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "IDEMPOTENCY_CONFLICT");
});

test("falha no segundo item rollback sem confirmacao", async () => {
  reset();
  state.failOnItemIndex = 1;
  const app = createApp();
  const res = await signedPost(
    app,
    "/api/v1/orders",
    payload({
      items: [
        { productId: 10, unitPrice: 10, quantity: 1, discount: 0 },
        { productId: 20, unitPrice: 20, quantity: 1, discount: 0 },
      ],
      total: 30,
    }),
    { "idempotency-key": "fail-item" },
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "ORDER_CREATE_FAILED");
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
  const confirm = state.calls.find((c) => /FROM ORDENS_VENDA\b/i.test(c.sql));
  assert.equal(confirm, undefined);
});

test("falha em equipamento rollback integral", async () => {
  reset();
  state.failOnEquipIndex = 0;
  const app = createApp();
  const res = await signedPost(app, "/api/v1/orders", payload(), {
    "idempotency-key": "fail-eq",
  });
  assert.equal(res.status, 500);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});

test("payload sem companyId + cliente GROTT companyId=3", async () => {
  reset();
  state.clientContext = { CLIENTE_ID_EMPRESA: 3, GRUPO_DESCRICAO: null };
  state.createdCompanyId = 3;
  const app = createApp();
  const res = await signedPost(
    app,
    "/api/v1/orders",
    payload({ companyId: null }),
    { "idempotency-key": "resolve-1" },
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.order.companyId, 3);
  const completeCall = state.calls.find((c) =>
    /FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(c.sql),
  );
  assert.equal(completeCall.params[0], 3);
});