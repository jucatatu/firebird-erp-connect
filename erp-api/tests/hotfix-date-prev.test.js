"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { toDateCivil } = require("../src/modules/orders/orders.mapper");

test("Order Date Mapper (toDateCivil)", async (t) => {
  await t.test("should parse YYYY-MM-DD correctly (noon fallback)", () => {
    const d = toDateCivil("2026-08-18");
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 7); // Aug is 7
    assert.strictEqual(d.getDate(), 18);
    assert.strictEqual(d.getHours(), 12);
  });

  await t.test("should parse YYYY-MM-DDTHH:mm:ss correctly (civil time)", () => {
    const d = toDateCivil("2026-08-18T16:30:00");
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getHours(), 16);
    assert.strictEqual(d.getMinutes(), 30);
  });

  await t.test("should handle partial seconds or minutes", () => {
    const d = toDateCivil("2026-08-18T08:05");
    assert.strictEqual(d.getHours(), 8);
    assert.strictEqual(d.getMinutes(), 5);
  });

  await t.test("should preserve minutes and seconds from HH:MM:ss string", () => {
    const d = toDateCivil("2026-08-18T15:45:30");
    assert.strictEqual(d.getHours(), 15);
    assert.strictEqual(d.getMinutes(), 45);
    assert.strictEqual(d.getSeconds(), 30);
  });
});

