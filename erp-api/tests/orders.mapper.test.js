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
    integrationUserId: 77,
    payload: {
      customerId: 100,
      sellerId: 10,
      saleTypeId: 1,
      paymentTermId: 2,
      paymentMethodId: 3,
      delivery: true,
      expectedDeliveryAt: "2026-07-25T14:00:00Z",
      deliveryAt: null,
      retrieveEquipment: false,
      returnAt: null,
      expectedReturnAt: null,
      total: 100,
      freight: 5,
      address: {
        state: "SC",
        city: "Corupa",
        district: "Centro",
        street: "R. A",
        number: "10",
        complement: null,
        postalCode: "89250000",
      },
      notes: null,
      stockOutput: true,
      userId: 999,
      carrierId: null,
      carrierVehicleId: null,
      commercialDiscountPercent: 0,
      posSessionId: null,
    },
  });
  assert.equal(params.length, 30);
  assert.equal(params[0], 3);
  assert.equal(params[1], 100);
  assert.equal(params[6], 1);
  assert.equal(params[22], 1);
  // SAIDA_ESTOQUE fixado em 0 no servidor, ignora payload.stockOutput=true
  assert.equal(params[23], 0);
  // ID_USER vem do integrationUserId (servidor), ignora payload.userId=999
  assert.equal(params[24], 77);
  assert.equal(params[25], null);
  assert.ok(params[7] instanceof Date);
});

test("buildItemProcParams CHAVE I", () => {
  const p = mapper.buildItemProcParams(500, {
    productId: 10,
    unitPrice: 15.5,
    quantity: 2,
    discount: 0,
  });
  assert.deepEqual(p, [500, 10, 15.5, 2, 0, "I"]);
});

test("buildEquipmentProcParams CHAVE I", () => {
  const p = mapper.buildEquipmentProcParams(500, {
    equipmentTypeId: 5,
    productId: null,
    quantity: 1,
  });
  assert.deepEqual(p, [500, 5, null, 1, "I"]);
});

test("truncate respeita limites do schema", () => {
  const long = "x".repeat(200);
  assert.equal(mapper.truncate(long, 60).length, 60);
  assert.equal(mapper.truncate(null, 10), null);
});

test("companyId nunca sai fora de 1 3", () => {
  assert.equal(mapper.resolveCompanyId(99, 99, "grott sub"), 3);
  assert.equal(mapper.resolveCompanyId(99, 99, "xxx"), 1);
});