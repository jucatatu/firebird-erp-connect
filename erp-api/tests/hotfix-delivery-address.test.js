"use strict";

require("./helpers/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCreateOrder } = require("../src/modules/orders/orders.validator");
const mapper = require("../src/modules/orders/orders.mapper");

function basePayload(overrides = {}) {
  return {
    companyId: 1,
    clientId: 100,
    sellerId: 10,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: "2026-07-25T14:30:00.000Z",
    returnEquipment: false,
    returnAt: null,
    freightValue: 0,
    notes: null,
    items: [{ productId: 10, quantity: 2 }],
    equipments: [],
    ...overrides,
  };
}

test("validator: aceita deliveryAddress customizado", () => {
  const customAddr = {
    street: "Rua Teste",
    number: "123",
    neighborhood: "Bairro Novo",
    city: "Jaraguá do Sul",
    state: "SC",
    postalCode: "89250000"
  };
  
  const p = validateCreateOrder(basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: customAddr
  }));
  
  assert.equal(p.deliveryAddressSource, "custom");
  assert.equal(p.deliveryAddress.street, "Rua Teste");
});

test("mapper: usa deliveryAddress customizado quando source=custom", () => {
  const customAddr = {
    street: "Rua Custom",
    number: "99",
    neighborhood: "Bairro Custom",
    city: "Cidade Custom",
    state: "PR",
    postalCode: "12345678"
  };
  
  const payload = basePayload({
    deliveryAddressSource: "custom",
    deliveryAddress: customAddr
  });
  
  const clientContext = {
    address: {
      street: "Rua Original",
      number: "1",
      district: "Centro",
      city: "Origem",
      state: "SC",
      zip: "88888888"
    }
  };
  
  const params = mapper.buildCompleteProcParams({
    payload,
    companyId: 1,
    clientContext,
    totals: { total: 100 }
  });
  
  // Mapeamento buildCompleteProcParams:
  // 14 UF, 15 CIDADE, 16 BAIRRO, 17 RUA, 18 NUMERO, 20 CEP
  assert.equal(params[14], "PR");
  assert.equal(params[15], "Cidade Custom");
  assert.equal(params[16], "Bairro Custom");
  assert.equal(params[17], "Rua Custom");
  assert.equal(params[18], "99");
  assert.equal(params[20], "12345678");
});

test("mapper: usa endereço do cliente quando source=client", () => {
  const payload = basePayload({
    deliveryAddressSource: "client",
    deliveryAddress: { street: "Ignorar" }
  });
  
  const clientContext = {
    address: {
      street: "Rua Cliente",
      number: "10",
      district: "Bairro Cliente",
      city: "Cidade Cliente",
      state: "SC",
      zip: "89000000"
    }
  };
  
  const params = mapper.buildCompleteProcParams({
    payload,
    companyId: 1,
    clientContext,
    totals: { total: 100 }
  });
  
  assert.equal(params[17], "Rua Cliente");
  assert.equal(params[18], "10");
});

test("mapper: preserva horário na DATA_PREV_ENTREGA", () => {
  const isoDate = "2026-07-25T14:30:00.000Z";
  const payload = basePayload({ deliveryAt: isoDate });
  
  const params = mapper.buildCompleteProcParams({
    payload,
    companyId: 1,
    clientContext: {},
    totals: { total: 100 }
  });
  
  const dateVal = params[7];
  assert.ok(dateVal instanceof Date, "Deve ser uma instância de Date");
  
  // A toDateCivil no mapper.js usa parsing que deve manter o horário
  // Dependendo do fuso do servidor de testes, validamos apenas se não resetou para 00:00 ou 12:00
  // a menos que a toDateCivil explicitamente faça o parse manual preservando civil time.
  const hours = dateVal.getUTCHours();
  const minutes = dateVal.getUTCMinutes();
  
  assert.equal(hours, 14, "Deve manter a hora 14");
  assert.equal(minutes, 30, "Deve manter os minutos 30");
});
