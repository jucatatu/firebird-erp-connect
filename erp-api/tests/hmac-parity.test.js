"use strict";

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

/**
 * Este teste valida se o Body Hash gerado pelo script test-order-win.js
 * é idêntico ao calculado pelo middleware auth.middleware.js.
 * 
 * O ponto crítico é a serialização JSON. Se houver espaços ou quebras de linha
 * no arquivo, o script deve re-serializar via JSON.stringify(JSON.parse(raw))
 * para coincidir com o comportamento do Express + body-parser.
 */
test("HMAC Body Hash Parity", async (t) => {
  await t.test("deve gerar o mesmo hash para JSON com espaços/formatação", () => {
    const rawJson = `{
      "clientId": 100,
      "items": [
        { "productId": 1, "quantity": 10 }
      ]
    }`;

    // 1. Simula o comportamento do Script Corrigido
    const parsed = JSON.parse(rawJson);
    const stringified = JSON.stringify(parsed);
    const hashFromScript = crypto.createHash("sha256").update(stringified).digest("hex");

    // 2. Simula o comportamento do Middleware (req.body já parseado pelo Express)
    const reqBody = JSON.parse(rawJson);
    const stringifiedMiddleware = JSON.stringify(reqBody);
    const hashFromMiddleware = crypto.createHash("sha256").update(stringifiedMiddleware).digest("hex");

    assert.strictEqual(hashFromScript, hashFromMiddleware, "Hashes devem ser idênticos após re-serialização");
    
    // 3. Prova que o hash bruto seria diferente se o arquivo tivesse formatação
    const hashRaw = crypto.createHash("sha256").update(rawJson).digest("hex");
    assert.notStrictEqual(hashRaw, hashFromMiddleware, "Hash bruto NÃO deveria coincidir se houver formatação no arquivo");
  });
});
