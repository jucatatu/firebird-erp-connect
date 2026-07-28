"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const rule = require("../src/shared/company/company-rule");
const operationsMapper = require("../src/modules/operations/operations.mapper");
const ordersMapper = require("../src/modules/orders/orders.mapper");

test("empresa explícita 3 → 3", () => {
  assert.equal(rule.resolveCompanyId({ explicitCompanyId: 3 }), 3);
});

test("empresa explícita 1 → 1", () => {
  assert.equal(rule.resolveCompanyId({ explicitCompanyId: 1, groupDescription: "GROTT" }), 1);
});

test("empresa nula + grupo GROTT → 3", () => {
  assert.equal(rule.resolveCompanyId({ groupDescription: "clientes grott sul" }), 3);
});

test("empresa nula + outro grupo → 1", () => {
  assert.equal(rule.resolveCompanyId({ groupDescription: "PADRAO" }), 1);
});

test("valor inválido não escapa como empresa válida", () => {
  for (const v of [0, 2, 7, -3, "abc", "2", null, undefined, {}, NaN, 1.5]) {
    const out = rule.resolveCompanyId({ explicitCompanyId: v });
    assert.ok(out === 1 || out === 3, `valor ${String(v)} gerou ${out}`);
  }
  assert.equal(rule.normalizeCompanyId(2), null);
  assert.equal(rule.normalizeCompanyId("3"), 3);
});

test("empresa resolve somente para 1 ou 3 em qualquer combinação", () => {
  const inputs = [{}, { clientCompanyId: 99 }, { explicitCompanyId: 4, clientCompanyId: 5 }];
  for (const i of inputs) assert.ok([1, 3].includes(rule.resolveCompanyId(i)));
});

test("operations.mapper delega à regra oficial (comportamento preservado)", () => {
  assert.equal(operationsMapper.resolveCompanyId({ ORDEM_ID_EMPRESA: 3 }), 3);
  assert.equal(operationsMapper.resolveCompanyId({ CLIENTE_ID_EMPRESA: 3 }), 3);
  assert.equal(
    operationsMapper.resolveCompanyId({ GRUPO_CLIENTE_DESCRICAO: "GROTT BEBIDAS" }),
    3,
  );
  assert.equal(operationsMapper.resolveCompanyId({ ORDEM_ID_EMPRESA: 2 }), 1);
});

test("orders.mapper delega à regra oficial (comportamento preservado)", () => {
  assert.equal(ordersMapper.resolveCompanyId(3, null, null), 3);
  assert.equal(ordersMapper.resolveCompanyId(null, 3, null), 3);
  assert.equal(ordersMapper.resolveCompanyId(null, null, "grott"), 3);
  assert.equal(ordersMapper.resolveCompanyId(2, null, null), 1);
});
