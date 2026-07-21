"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseStrictDate,
  parseCompanies,
  validateListOrdersQuery,
  ALLOWED_COMPANIES,
} = require("../src/modules/operations/operations.validator");
const { toFirebirdDate } = require("../src/modules/operations/operations.service");

test("date válida no formato YYYY-MM-DD", () => {
  assert.deepEqual(parseStrictDate("2026-07-21"), { valid: true, value: "2026-07-21" });
});

test("date rejeita formato inválido, string vazia e texto", () => {
  assert.equal(parseStrictDate("21/07/2026").valid, false);
  assert.equal(parseStrictDate("2026-7-21").valid, false);
  assert.equal(parseStrictDate("").valid, false);
  assert.equal(parseStrictDate("abc").valid, false);
});

test("date rejeita data impossível (2026-02-30, 2026-13-01)", () => {
  assert.equal(parseStrictDate("2026-02-30").valid, false);
  assert.equal(parseStrictDate("2026-13-01").valid, false);
  assert.equal(parseStrictDate("2026-00-10").valid, false);
});

test("toFirebirdDate converte YYYY-MM-DD → MM/DD/YYYY", () => {
  assert.equal(toFirebirdDate("2026-07-21"), "07/21/2026");
  assert.equal(toFirebirdDate("2026-01-05"), "01/05/2026");
});

test("companies ausente normaliza para [1,3]", () => {
  assert.deepEqual(parseCompanies(undefined), { valid: true, value: [1, 3] });
});

test("companies=1 → [1]; companies=3,1 → [1,3]", () => {
  assert.deepEqual(parseCompanies("1"), { valid: true, value: [1] });
  assert.deepEqual(parseCompanies("3,1"), { valid: true, value: [1, 3] });
});

test("companies inválido rejeitado", () => {
  assert.equal(parseCompanies("").valid, false);
  assert.equal(parseCompanies(",").valid, false);
  assert.equal(parseCompanies("abc").valid, false);
  assert.equal(parseCompanies("1.5").valid, false);
  assert.equal(parseCompanies("-1").valid, false);
  assert.equal(parseCompanies("2").valid, false);
});

test("ALLOWED_COMPANIES = [1,3]", () => {
  assert.deepEqual([...ALLOWED_COMPANIES], [1, 3]);
});

test("validateListOrdersQuery lança VALIDATION_ERROR com details quando date ausente", () => {
  try {
    validateListOrdersQuery({});
    assert.fail("deveria lançar");
  } catch (err) {
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.statusCode, 400);
    assert.ok(Array.isArray(err.details));
    assert.ok(err.details.some((d) => d.field === "date"));
  }
});

test("validateListOrdersQuery retorna estrutura normalizada com companies", () => {
  const r = validateListOrdersQuery({ date: "2026-07-21", companies: "3,1" });
  assert.deepEqual(r, { date: "2026-07-21", companies: [1, 3] });
});

test("validateListOrdersQuery aceita alias legado empresas", () => {
  const r = validateListOrdersQuery({ date: "2026-07-21", empresas: "1" });
  assert.deepEqual(r.companies, [1]);
});