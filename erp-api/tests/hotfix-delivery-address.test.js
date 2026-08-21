"use strict";

require("./helpers/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCreateOrder } = require("../src/modules/orders/orders.validator");
const mapper = require("../src/modules/orders/orders.mapper");

// Mock de AppError para testes unitários isolados se necessário, 
// mas aqui usaremos a implementação real do service.js
const ordersService = require("../src/modules/orders/orders.service");

function basePayload(overrides = {}) {
  return {
    companyId: 1,
    clientId: 100,
    sellerId: 10,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: "2026-08-21T09:37:00",
    returnEquipment: false,
    returnAt: null,
    freightValue: 0,
    notes: null,
    items: [{ productId: 10, quantity: 2 }],
    equipments: [],
    ...overrides,
  };
}

test("resolveDeliveryAddress: usa custom completo com sucesso", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B",
      number: "500",
      neighborhood: "Bairro Novo",
      city: "Jaraguá do Sul",
      state: "SC",
      postalCode: "89250-000"
    }
  });
  
  const addr = ordersService.testable_resolveDeliveryAddress(payload, {});
  assert.equal(addr.street, "Rua B");
  assert.equal(addr.zip, "89250000"); // Normalizado de 89250-000
  assert.equal(addr.state, "SC");
  assert.equal(addr.district, "Bairro Novo");
});

test("resolveDeliveryAddress: normaliza CEP sem máscara 89250000", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B",
      number: "500",
      neighborhood: "B",
      city: "J",
      state: "sc",
      postalCode: "89250000"
    }
  });
  
  const addr = ordersService.testable_resolveDeliveryAddress(payload, {});
  assert.equal(addr.zip, "89250000");
  assert.equal(addr.state, "SC"); // Uppercase
});

test("resolveDeliveryAddress: erro se CEP custom curto (123)", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B", number: "500", neighborhood: "B", city: "J", state: "SC",
      postalCode: "123"
    }
  });
  
  assert.throws(
    () => ordersService.testable_resolveDeliveryAddress(payload, {}),
    (e) => e.code === "DELIVERY_ADDRESS_INCOMPLETE" && e.statusCode === 422
  );
});

test("resolveDeliveryAddress: erro se CEP custom longo (123456789)", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B", number: "500", neighborhood: "B", city: "J", state: "SC",
      postalCode: "123456789"
    }
  });
  
  assert.throws(
    () => ordersService.testable_resolveDeliveryAddress(payload, {}),
    (e) => e.code === "DELIVERY_ADDRESS_INCOMPLETE" && e.statusCode === 422
  );
});

test("resolveDeliveryAddress: erro se CEP client inválido (source=client)", () => {
  const payload = basePayload({
    deliveryAddressSource: "client"
  });
  
  const client = {
    address: { 
      street: "Rua A", number: "1", district: "B", city: "C", state: "S",
      zip: "123" // Inválido
    }
  };
  
  assert.throws(
    () => ordersService.testable_resolveDeliveryAddress(payload, client),
    (e) => e.code === "CLIENT_ADDRESS_INCOMPLETE" && e.statusCode === 422
  );
});

test("validator: permite CEP semanticamente incorreto estruturalmente", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B", number: "500", neighborhood: "B", city: "J", state: "SC",
      postalCode: "123" // Semanticamente incorreto, mas estruturalmente string ok para Zod
    }
  });
  
  // Não deve lançar VALIDATION_ERROR (400)
  const validated = validateCreateOrder(payload);
  assert.equal(validated.deliveryAddress.postalCode, "123");
});



test("resolveDeliveryAddress: erro 422 se custom incompleto (falta cidade)", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B",
      number: "500",
      neighborhood: "Bairro",
      state: "SC",
      postalCode: "89250000"
      // city faltando
    }
  });
  
  assert.throws(
    () => ordersService.testable_resolveDeliveryAddress(payload, {}),
    (e) => e.code === "DELIVERY_ADDRESS_INCOMPLETE" && e.statusCode === 422
  );
});

test("resolveDeliveryAddress: permite cadastro incompleto se custom estiver ok", () => {
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: {
      street: "Rua B",
      number: "500",
      neighborhood: "Bairro",
      city: "Jaraguá",
      state: "SC",
      postalCode: "89250000"
    }
  });
  
  const client = {
    address: { street: "Rua Incompleta" } // Cadastro falharia se fosse source=client
  };
  
  const addr = ordersService.testable_resolveDeliveryAddress(payload, client);
  assert.equal(addr.street, "Rua B");
});

test("resolveDeliveryAddress: erro se source=client e cadastro estiver incompleto", () => {
  const payload = basePayload({
    deliveryAddressSource: "client"
  });
  
  const client = {
    address: { street: "Rua A", city: "C" } // Faltam campos
  };
  
  assert.throws(
    () => ordersService.testable_resolveDeliveryAddress(payload, client),
    (e) => e.code === "CLIENT_ADDRESS_INCOMPLETE"
  );
});

test("resolveDeliveryAddress: retirada (deliver=false) não exige endereço", () => {
  const payload = basePayload({
    deliver: false,
    deliveryAddressSource: "custom",
    deliveryAddress: null // Seria erro se deliver=true
  });
  
  const addr = ordersService.testable_resolveDeliveryAddress(payload, {});
  assert.strictEqual(addr, null);
});

test("mapper: toDateCivil preserva horário civil local 09:37", () => {
  const input = "2026-08-21T09:37";
  const date = mapper.toDateCivil(input);
  
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 7); // Agosto
  assert.equal(date.getDate(), 21);
  assert.equal(date.getHours(), 9);
  assert.equal(date.getMinutes(), 37);
});

test("mapper: toDateCivil preserva horário civil local 16:45", () => {
  const input = "2026-08-21T16:45";
  const date = mapper.toDateCivil(input);
  
  assert.equal(date.getHours(), 16);
  assert.equal(date.getMinutes(), 45);
});

test("mapper: returnAt preserva horário 11:20", () => {
  const payload = basePayload({
    returnAt: "2026-08-23T11:20"
  });
  
  const params = mapper.buildCompleteProcParams({
    payload,
    companyId: 1,
    clientContext: {},
    deliveryAddress: { street: "X" },
    totals: { total: 100 }
  });
  
  const returnDate = params[11]; // DATA_PREV_RETORNO
  assert.equal(returnDate.getHours(), 11);
  assert.equal(returnDate.getMinutes(), 20);
});

test("mapper: ENTREGAR é 1 para entrega e NULL para retirada", () => {
  const pEntrega = mapper.buildCompleteProcParams({
    payload: basePayload({ deliver: true }),
    companyId: 1,
    clientContext: {},
    deliveryAddress: { street: "X" },
    totals: { total: 100 }
  });
  assert.strictEqual(pEntrega[6], 1);
  
  const pRetirada = mapper.buildCompleteProcParams({
    payload: basePayload({ deliver: false }),
    companyId: 1,
    clientContext: {},
    deliveryAddress: null,
    totals: { total: 100 }
  });
  assert.strictEqual(pRetirada[6], null);
});
