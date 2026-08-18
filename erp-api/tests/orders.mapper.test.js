"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const mapper = require("../src/modules/orders/orders.mapper");

test("resolveCompanyId payload=3 vence tudo", () => {
  assert.equal(mapper.resolveCompanyId(3, 1, "CLIENTES GERAIS"), 3);
});
test("resolveCompanyId payload=1 vence tudo", () => {
  assert.equal(mapper.resolveCompanyId(1, 3, "PONTO GROTT"), 1);
});
test("resolveCompanyId payload=null usa cliente=3", () => {
  assert.equal(mapper.resolveCompanyId(null, 3, null), 3);
});
test("resolveCompanyId null null grupo GROTT vira 3", () => {
  assert.equal(mapper.resolveCompanyId(null, null, "PONTO DE VENDA - GROTT"), 3);
});
test("resolveCompanyId fallback vira 1", () => {
  assert.equal(mapper.resolveCompanyId(null, null, null), 1);
  assert.equal(mapper.resolveCompanyId(null, 2, "CLIENTES GERAIS"), 1);
});

test("buildCompleteProcParams 30 posicoes GERA_COBRANCA=1 CHAVE=null", () => {
  const params = mapper.buildCompleteProcParams({
    companyId: 3,
    totals: { total: 105.00 },
    clientContext: {
      address: {
        state: "SC",
        city: "Corupa",
        district: "Centro",
        street: "R. A",
        number: "10",
        complement: null,
        postalCode: "89250000",
      }
    },
    payload: {
      clientId: 100,
      sellerId: 10,
      saleTypeId: 1,
      paymentTermId: 2,
      paymentMethodId: 3,
      deliver: true,
      deliveryAt: "2026-07-25T14:00:00Z",
      returnEquipment: false,
      returnAt: null,
      freightValue: 5,
      notes: null,
    },
  });
  assert.equal(params.length, 30);
  assert.equal(params[0], 3);
  assert.equal(params[1], 100);
  assert.equal(params[6], 1);
  assert.equal(params[12], 105.00);
  assert.equal(params[22], 1);
  assert.equal(params[23], 0);
  assert.equal(params[24], 2);
  assert.equal(params[24], mapper.CAD_USER);
  assert.equal(params[25], null);
  assert.ok(params[7] instanceof Date);
});

test("buildCompleteProcParams deliver=false resulta em ENTREGAR=null (Retirada)", () => {
  const params = mapper.buildCompleteProcParams({
    companyId: 1,
    totals: { total: 50.0 },
    payload: {
      clientId: 1,
      sellerId: 1,
      deliver: false, // RETIRADA
    },
  });
  assert.strictEqual(params[6], null, "ENTREGAR deve ser null para retirada");
  assert.notEqual(params[6], 0, "ENTREGAR nunca deve ser 0");
});

test("buildCompleteProcParams deliver=true resulta em ENTREGAR=1 (Entrega)", () => {
  const params = mapper.buildCompleteProcParams({
    companyId: 1,
    totals: { total: 50.0 },
    payload: {
      clientId: 1,
      sellerId: 1,
      deliver: true, // ENTREGA
    },
  });
  assert.strictEqual(params[6], 1, "ENTREGAR deve ser 1 para entrega");
});

test("buildItemProcParams CHAVE I", () => {
...
test("truncate respeita limites do schema", () => {
  const long = "x".repeat(200);
  assert.equal(mapper.truncate(long, 60).length, 60);
  assert.equal(mapper.truncate(null, 10), null);
});

test("companyId nunca sai fora de 1 3", () => {
  assert.equal(mapper.resolveCompanyId(99, 99, "grott sub"), 3);
  assert.equal(mapper.resolveCompanyId(99, 99, "xxx"), 1);
});
