"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeCursor, decodeCursor } = require("../src/shared/pagination/keyset-cursor");
const { buildQPatterns, foldToLikePattern } = require("../src/shared/search/like-pattern");

test("cursor é opaco e faz round-trip", () => {
  const c = encodeCursor(42);
  assert.ok(!/^\d+$/.test(c));
  assert.deepEqual(decodeCursor(c), { lastId: 42 });
});

test("cursor inválido, forjado ou com campos extras é rejeitado", () => {
  assert.equal(decodeCursor("abc!!"), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor(null), null);
  assert.equal(decodeCursor(Buffer.from('{"v":1,"lastId":-5}').toString("base64url")), null);
  assert.equal(decodeCursor(Buffer.from('{"v":2,"lastId":5}').toString("base64url")), null);
  assert.equal(
    decodeCursor(Buffer.from('{"v":1,"lastId":5,"table":"PRODUTOS"}').toString("base64url")),
    null,
  );
  assert.equal(decodeCursor("a".repeat(500)), null);
});

test("folding trata termo acentuado e não acentuado igualmente", () => {
  assert.equal(foldToLikePattern("elétrica"), foldToLikePattern("eletrica"));
  assert.equal(foldToLikePattern("eletrica"), "%_L_TR___%");
  assert.deepEqual(buildQPatterns("CP50"), ["%CP50%", "%_P50%"]);
});

test("coringas digitados pelo usuário são neutralizados", () => {
  for (const p of buildQPatterns("%_a%_")) {
    assert.equal(p.slice(1, -1).includes("%"), false);
  }
});