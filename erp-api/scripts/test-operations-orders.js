#!/usr/bin/env node
"use strict";

/**
 * Script de teste manual — GET /api/v1/operations/orders
 *
 * Uso:
 *   node scripts/test-operations-orders.js [date] [companies]
 *
 * Exemplo:
 *   node scripts/test-operations-orders.js 2026-07-21 1,3
 *
 * Requisitos:
 *   - Node.js >= 18 (usa fetch nativo)
 *   - .env com API_KEY, HMAC_SECRET e API_BASE_URL (opcional).
 *
 * IMPORTANTE:
 *   - Este script gera HMAC apenas no servidor/CLI. Nunca gerar
 *     assinatura no navegador — o segredo não pode sair do backend.
 *   - Nenhuma chave é embutida no código.
 */

const crypto = require("crypto");
const path = require("path");

// Carrega .env do diretório erp-api independente do CWD.
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch (_e) {
  /* dotenv opcional */
}

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3000";
const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

if (!API_KEY || !HMAC_SECRET) {
  console.error(
    "[erro] Defina API_KEY e HMAC_SECRET no .env antes de rodar este script.",
  );
  process.exit(1);
}

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const companies = process.argv[3] || "1,3";

const qs = new URLSearchParams({ date, companies }).toString();
const urlPath = `/api/v1/operations/orders?${qs}`;
const url = `${API_BASE_URL}${urlPath}`;

const method = "GET";
const timestamp = String(Date.now());
const nonce = crypto.randomBytes(12).toString("hex");
const bodyHash = crypto.createHash("sha256").update("").digest("hex");
const canonical = [method, urlPath, timestamp, nonce, bodyHash].join("\n");
const signature = crypto.createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");

(async () => {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "x-api-key": API_KEY,
        "x-timestamp": timestamp,
        "x-nonce": nonce,
        "x-signature": signature,
      },
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (_e) {
      json = text;
    }
    console.log("URL:", url);
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(json, null, 2));
    process.exit(res.ok ? 0 : 2);
  } catch (err) {
    console.error("[erro de rede]", err && err.message);
    process.exit(3);
  }
})();