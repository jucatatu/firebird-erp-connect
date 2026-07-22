#!/usr/bin/env node
"use strict";

/**
 * Diagnóstico manual — POST /api/v1/map/geocode + GET /api/v1/map/orders.
 *
 * Uso:
 *   node scripts/test-geocode.js <orderId> [date]
 *
 * Exemplo:
 *   node scripts/test-geocode.js 8433 2026-07-22
 *
 * O script:
 *   1. Dispara POST /api/v1/map/geocode com { orderIds: [<id>] }.
 *   2. Loga URL, headers de auth (redigidos), body, status, tempo e resposta.
 *   3. Consulta GET /api/v1/map/orders?date=<date> e imprime o pedido alvo.
 *
 * IMPORTANTE: gera HMAC no CLI; nunca no navegador.
 */

const crypto = require("crypto");
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch (_e) {
  /* dotenv opcional */
}

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3052";
const API_KEY = process.env.API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET;

if (!API_KEY || !HMAC_SECRET) {
  console.error("[erro] Defina API_KEY e HMAC_SECRET no .env.");
  process.exit(1);
}

const orderId = Number(process.argv[2]);
if (!Number.isInteger(orderId) || orderId <= 0) {
  console.error("[erro] Informe um orderId inteiro positivo. Ex: node scripts/test-geocode.js 8433 2026-07-22");
  process.exit(1);
}
const date = process.argv[3] || new Date().toISOString().slice(0, 10);

function sign(method, urlPath, bodyStr) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(12).toString("hex");
  const bodyHash = crypto.createHash("sha256").update(bodyStr || "").digest("hex");
  const canonical = [method, urlPath, timestamp, nonce, bodyHash].join("\n");
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");
  return {
    "x-api-key": API_KEY,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": signature,
  };
}

function redactHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (k === "x-api-key" || k === "x-signature") out[k] = "[REDACTED]";
    else out[k] = v;
  }
  return out;
}

async function callJson(method, urlPath, bodyObj) {
  const bodyStr = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
  const headers = sign(method, urlPath, bodyStr);
  if (bodyObj !== undefined) headers["content-type"] = "application/json";
  const url = `${API_BASE_URL}${urlPath}`;
  const started = Date.now();
  const res = await fetch(url, { method, headers, body: bodyObj === undefined ? undefined : bodyStr });
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_e) {
    json = text;
  }
  return { url, method, headers: redactHeaders(headers), body: bodyObj ?? null, status: res.status, elapsedMs, json };
}

(async () => {
  try {
    console.log(`\n═══ 1) POST /api/v1/map/geocode  { orderIds: [${orderId}] } ═══`);
    const post = await callJson("POST", "/api/v1/map/geocode", { orderIds: [orderId] });
    console.log(JSON.stringify(post, null, 2));

    console.log(`\n═══ 2) GET /api/v1/map/orders?date=${date} ═══`);
    const get = await callJson("GET", `/api/v1/map/orders?date=${encodeURIComponent(date)}`);
    const summary = get.json?.data?.summary || get.json?.summary;
    const orders = get.json?.data?.orders || get.json?.orders || [];
    const target = orders.find((o) => Number(o.orderId) === orderId);
    console.log("Status:", get.status, "elapsedMs:", get.elapsedMs);
    console.log("Summary:", JSON.stringify(summary, null, 2));
    if (target) {
      console.log(`\n─── Pedido #${orderId} no GET ───`);
      console.log(JSON.stringify({ orderId: target.orderId, orderNumber: target.orderNumber, address: target.address, location: target.location }, null, 2));
    } else {
      console.log(`\n[aviso] Pedido #${orderId} não apareceu no GET para date=${date}.`);
    }

    console.log("\n═══ Checklist ═══");
    console.log("- cacheKey POST vs GET devem ser IDÊNTICAS (compare com os logs do erp-api).");
    console.log("- Se location.source ficou 'pending' após POST 'resolved':");
    console.log("    * cache in-memory + PM2 cluster? verifique 'pm2 list' (usar instances=1 ou fork mode).");
    console.log("    * processo reiniciou entre POST e GET?");
    console.log("- Se POST retornou status='error' com PROVIDER_ERROR: Google devolveu status != OK/ZERO_RESULTS.");
    console.log("    * Confira GEOCODING_PROVIDER, GOOGLE_GEOCODING_API_KEY, billing e restrições da chave.");

    process.exit(post.status < 400 && get.status < 400 ? 0 : 2);
  } catch (err) {
    console.error("[erro]", err && err.message ? err.message : err);
    process.exit(3);
  }
})();