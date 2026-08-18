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
  // Concorrência
  activeTx: 0,
  maxActiveTx: 0,
  pendingOrderIds: null, // Array<number> ou null (usa createdOrderId)
  holdFirstMs: 0,        // segura a 1ª chamada da proc principal
  firstHeld: false,
};

async function txQuery(sql, params, txState) {
  state.calls.push({ sql, params });
  if (/FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(sql)) {
    if (state.holdFirstMs > 0 && !state.firstHeld) {
      state.firstHeld = true;
      await new Promise((r) => setTimeout(r, state.holdFirstMs));
    }
    const id =
      state.pendingOrderIds && state.pendingOrderIds.length
        ? state.pendingOrderIds.shift()
        : state.createdOrderId;
    txState.orderId = id;
    return [{ ID: id }];
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
  if (/SP_CAD_EQUIP_ORDENS_VENDA/i.test(sql)) {
    const idx = state.equipCallCount++;
    if (state.failOnEquipIndex === idx) {
      throw Object.assign(new Error("simulated equip failure"), { code: "SIMULATED" });
    }
    // EXECUTE PROCEDURE não retorna linhas.
    return [];
  }
  if (/FROM ORDENS_VENDA\b/i.test(sql)) {
    const oid = txState.orderId || state.createdOrderId;
    return [
      {
        ID_ORDENS_VENDA: oid,
        N_PEDIDO: oid, // N_PEDIDO = ID no ERP
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
      state.activeTx++;
      if (state.activeTx > state.maxActiveTx) state.maxActiveTx = state.activeTx;
      const txState = { orderId: null };
      const tx = {
        query: async (sql, params) => txQuery(sql, params || [], txState),
      };
      try {
        const r = await fn(tx);
        state.commits++;
        return r;
      } catch (err) {
        state.rollbacks++;
        throw err;
      } finally {
        state.activeTx--;
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
    clientId: 100, // ID real no schema ERP
    companyId: 1,
    sellerId: 10,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true, // boolean real
    deliveryAt: "2026-07-25T14:00:00.000Z",
    returnEquipment: false, // boolean real
    returnAt: null,
    freightValue: 0, // finite number
    notes: null,
    items: [{ productId: 10, manualUnitPrice: 15.5, quantity: 2 }],
    equipments: [{ equipmentTypeId: 5, quantity: 1 }],
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
  state.activeTx = 0;
  state.maxActiveTx = 0;
  state.pendingOrderIds = null;
  state.holdFirstMs = 0;
  state.firstHeld = false;
  state.createdOrderId = 999;
  state.createdCompanyId = 1;
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
  assert.equal(res.body.data.id, 999);
  // N_PEDIDO = ID no ERP.
  assert.equal(res.body.data.orderNumber, 999);
  assert.equal(res.body.data.companyId, 1);
  assert.equal(res.body.data.status, "LIBERADO");
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
    /SP_CAD_EQUIP_ORDENS_VENDA/i.test(c.sql),
  );
  // Deve usar EXECUTE PROCEDURE (proc sem SUSPEND / sem retorno).
  assert.match(eqCall.sql, /EXECUTE PROCEDURE SP_CAD_EQUIP_ORDENS_VENDA/i);
  assert.doesNotMatch(eqCall.sql, /\bSELECT\b/i);
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
  assert.equal(res.body.data.companyId, 3);
  const completeCall = state.calls.find((c) =>
    /FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(c.sql),
  );
  assert.equal(completeCall.params[0], 3);
});

test("mutex global serializa criações concorrentes (chaves distintas)", async () => {
  reset();
  state.holdFirstMs = 60;
  state.pendingOrderIds = [1001, 1002];
  const app = createApp();
  const p1 = signedPost(
    app,
    "/api/v1/orders",
    payload({ total: 31 }),
    { "idempotency-key": "conc-A" },
  );
  const p2 = signedPost(
    app,
    "/api/v1/orders",
    payload({
      total: 40,
      items: [{ productId: 20, unitPrice: 20, quantity: 2, discount: 0 }],
    }),
    { "idempotency-key": "conc-B" },
  );
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
  // Serialização: nunca mais de 1 transação ativa ao mesmo tempo.
  assert.equal(state.maxActiveTx, 1);
  // IDs distintos, cada resposta corresponde ao próprio payload.
  assert.notEqual(r1.body.data.id, r2.body.data.id);
  assert.ok([1001, 1002].includes(r1.body.data.id));
  assert.ok([1001, 1002].includes(r2.body.data.id));
  assert.equal(state.commits, 2);
  assert.equal(state.rollbacks, 0);
});

test("SAIDA_ESTOQUE fixado em 0 e ID_USER vem da constante CAD_USER", async () => {
  reset();
  const app = createApp();
  const res = await signedPost(
    app,
    "/api/v1/orders",
    payload({ stockOutput: true, userId: 999 }),
    { "idempotency-key": "audit-1" },
  );
  assert.equal(res.status, 201);
  const completeCall = state.calls.find((c) =>
    /FROM SP_CAD_ORDEM_VENDA_COMPLETO/i.test(c.sql),
  );
  assert.equal(completeCall.params[23], 0); // SAIDA_ESTOQUE
  assert.equal(completeCall.params[24], 2); // ID_USER (constante CAD_USER)
});