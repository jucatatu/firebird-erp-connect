"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const { validateSearchQuery, validateClientId, LIMITS } = require("../src/modules/clients/clients.validator");

function expectValidation(fn, field) {
  try {
    fn();
    assert.fail("deveria ter lançado VALIDATION_ERROR");
  } catch (err) {
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.statusCode, 400);
    if (field) assert.ok(err.details.some((d) => d.field === field), JSON.stringify(err.details));
  }
}

test("busca sem nenhum filtro é rejeitada", () => {
  expectValidation(() => validateSearchQuery({}));
});

test("cursor sozinho é permitido (continuação de paginação)", () => {
  const out = validateSearchQuery({ cursor: "500" });
  assert.equal(out.cursor, 500);
  assert.equal(out.limit, LIMITS.LIMIT_DEFAULT);
});

test("q abaixo do mínimo é rejeitado", () => {
  expectValidation(() => validateSearchQuery({ q: "ab" }), "q");
});

test("q acima do máximo é rejeitado", () => {
  expectValidation(() => validateSearchQuery({ q: "a".repeat(LIMITS.Q_MAX + 1) }), "q");
});

test("limit acima do teto é rejeitado", () => {
  expectValidation(() => validateSearchQuery({ q: "jose", limit: String(LIMITS.LIMIT_MAX + 1) }), "limit");
});

test("limit padrão pequeno quando ausente", () => {
  assert.equal(validateSearchQuery({ q: "jose" }).limit, LIMITS.LIMIT_DEFAULT);
});

test("companyId fora de {1,3} é rejeitado", () => {
  for (const v of ["2", "0", "-1", "abc", "10"]) {
    expectValidation(() => validateSearchQuery({ q: "jose", companyId: v }), "companyId");
  }
  assert.equal(validateSearchQuery({ q: "jose", companyId: "3" }).companyId, 3);
  assert.equal(validateSearchQuery({ q: "jose", companyId: "1" }).companyId, 1);
});

test("document e phone são reduzidos a dígitos", () => {
  assert.equal(validateSearchQuery({ document: "12.345.678/0001-99" }).document, "12345678000199");
  assert.equal(validateSearchQuery({ phone: "(47) 99988-7766" }).phone, "47999887766");
});

test("valores duplicados no query string são rejeitados", () => {
  expectValidation(() => validateSearchQuery({ q: ["jose", "maria"] }), "q");
});

test("clientId inválido é rejeitado", () => {
  for (const v of ["abc", "-1", "0", "1.5", "", undefined, "99999999999"]) {
    expectValidation(() => validateClientId(v), "clientId");
  }
  assert.equal(validateClientId("123"), 123);
});
