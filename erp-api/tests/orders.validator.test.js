"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const { validateCreateOrder } = require("../src/modules/orders/orders.validator");

function basePayload(overrides = {}) {
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
      city: "Jaraguá do Sul",
      district: "Centro",
      street: "Rua A",
      number: "100",
      complement: null,
      postalCode: "89250-000",
    },
    notes: null,
    stockOutput: false,
    userId: 5,
    carrierId: null,
    carrierVehicleId: null,
    commercialDiscountPercent: 0,
    posSessionId: null,
    items: [{ productId: 10, unitPrice: 15.5, quantity: 2, discount: 0 }],
    equipment: [],
    ...overrides,
  };
}

test("payload valido e aceito e CEP e normalizado para 8 digitos", () => {
  const p = validateCreateOrder(basePayload());
  assert.equal(p.address.postalCode, "89250000");
  assert.equal(p.total, 31);
});

test("items vazio VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ items: [] })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("total <= 0 VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ total: 0 })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("companyId fora de {1,3,null} VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ companyId: 2 })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("duplicata de productId em items VALIDATION_ERROR", () => {
  assert.throws(
    () =>
      validateCreateOrder(
        basePayload({
          items: [
            { productId: 10, unitPrice: 15.5, quantity: 1, discount: 0 },
            { productId: 10, unitPrice: 15.5, quantity: 1, discount: 0 },
          ],
          total: 31,
        }),
      ),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("duplicata de equipmentTypeId VALIDATION_ERROR", () => {
  assert.throws(
    () =>
      validateCreateOrder(
        basePayload({
          equipment: [
            { equipmentTypeId: 5, productId: null, quantity: 1 },
            { equipmentTypeId: 5, productId: null, quantity: 1 },
          ],
        }),
      ),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("total diverge da soma dos itens alem da tolerancia VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ total: 999 })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("total coincide dentro da tolerancia 0.01", () => {
  const p = validateCreateOrder(basePayload({ total: 31.005 }));
  assert.ok(Math.abs(p.total - 31) < 0.01);
});

test("quantity <= 0 VALIDATION_ERROR", () => {
  assert.throws(
    () =>
      validateCreateOrder(
        basePayload({
          items: [{ productId: 10, unitPrice: 15.5, quantity: 0, discount: 0 }],
        }),
      ),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("valor infinito NaN VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ freight: Number.POSITIVE_INFINITY })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("campos desconhecidos sao rejeitados strict", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ geraCobranca: 0 })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});