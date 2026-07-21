"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseStrictDate,
  parseEmpresas,
  validateListOrdersQuery,
  ALLOWED_EMPRESAS,
} = require("../src/modules/operations/operations.validator");

test("date válida no formato YYYY-MM-DD", () => {
  assert.deepEqual(parseStrictDate("2026-07-21"), { valid: true, value: "2026-07-21" });
});

test("date rejeita formato diferente", () => {
  assert.equal(parseStrictDate("21/07/2026").valid, false);
  assert.equal(parseStrictDate("2026-7-21").valid, false);
  assert.equal(parseStrictDate("2026-07-21T00:00:00").valid, false);
  assert.equal(parseStrictDate("").valid, false);
  assert.equal(parseStrictDate("abc").valid, false);
});

test("date rejeita data impossível (2026-02-30)", () => {
  assert.equal(parseStrictDate("2026-02-30").valid, false);
  assert.equal(parseStrictDate("2026-13-01").valid, false);
  assert.equal(parseStrictDate("2026-00-10").valid, false);
});

test("empresas ausente normaliza para [1,3]", () => {
  assert.deepEqual(parseEmpresas(undefined), { valid: true, value: [1, 3] });
});

test("empresas=1 → [1]; empresas=3,1 → [1,3]", () => {
  assert.deepEqual(parseEmpresas("1"), { valid: true, value: [1] });
  assert.deepEqual(parseEmpresas("3,1"), { valid: true, value: [1, 3] });
  assert.deepEqual(parseEmpresas(" 3 , 1 , 1 "), { valid: true, value: [1, 3] });
});

test("empresas inválido: vazio, letras, decimais, negativo, empresa fora da allowlist", () => {
  assert.equal(parseEmpresas("").valid, false);
  assert.equal(parseEmpresas(",").valid, false);
  assert.equal(parseEmpresas("1,").valid, false);
  assert.equal(parseEmpresas("abc").valid, false);
  assert.equal(parseEmpresas("1.5").valid, false);
  assert.equal(parseEmpresas("-1").valid, false);
  assert.equal(parseEmpresas("2").valid, false);
  assert.equal(parseEmpresas("1,2").valid, false);
});

test("ALLOWED_EMPRESAS = [1,3]", () => {
  assert.deepEqual([...ALLOWED_EMPRESAS], [1, 3]);
});

test("validateListOrdersQuery lança AppError com details quando falha", () => {
  try {
    validateListOrdersQuery({});
    assert.fail("deveria lançar");
  } catch (err) {
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.statusCode, 400);
    assert.equal(err.exposeDetails, true);
    assert.ok(Array.isArray(err.details));
    assert.ok(err.details.some((d) => d.field === "date"));
  }
});

test("validateListOrdersQuery retorna estrutura normalizada", () => {
  const r = validateListOrdersQuery({ date: "2026-07-21", empresas: "3,1" });
  assert.deepEqual(r, { date: "2026-07-21", empresas: [1, 3] });
});

test("validateListOrdersQuery empresas ausente usa allowlist padrão", () => {
  const r = validateListOrdersQuery({ date: "2026-07-21" });
  assert.deepEqual(r.empresas, [1, 3]);
});
