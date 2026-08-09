"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const { validateCreateOrder } = require("../src/modules/orders/orders.validator");

function basePayload(overrides = {}) {
  return {
    companyId: 1,
    clientId: 100,
    sellerId: 10,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: "2026-07-25T14:00:00.000Z",
    returnEquipment: false,
    returnAt: null,
    freightValue: 0,
    notes: null,
    items: [{ productId: 10, quantity: 2 }],
    equipments: [],
    ...overrides,
  };
}

test("payload valido e aceito", () => {
  const p = validateCreateOrder(basePayload());
  assert.equal(p.clientId, 100);
});

test("items vazio VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ items: [] })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("companyId fora de {1,3} VALIDATION_ERROR", () => {
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
            { productId: 10, quantity: 1 },
            { productId: 10, quantity: 1 },
          ],
        }),
      ),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("quantity <= 0 VALIDATION_ERROR", () => {
  assert.throws(
    () =>
      validateCreateOrder(
        basePayload({
          items: [{ productId: 10, quantity: 0 }],
        }),
      ),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("valor infinito NaN VALIDATION_ERROR", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ freightValue: Number.POSITIVE_INFINITY })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});

test("campos desconhecidos sao rejeitados strict", () => {
  assert.throws(
    () => validateCreateOrder(basePayload({ extraField: true })),
    (e) => e.code === "VALIDATION_ERROR",
  );
});
