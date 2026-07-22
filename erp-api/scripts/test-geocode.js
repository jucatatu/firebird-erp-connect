#!/usr/bin/env node
"use strict";

/**
 * Diagnóstico ponta-a-ponta do fluxo de geocodificação.
 *
 * Uso:
 *   node scripts/test-geocode.js <orderNumber> [date]
 *
 * Passos:
 *   1) GET /api/v1/map/orders?date=<date> — localiza o pedido pelo
 *      N_PEDIDO (visível) e obtém o ID interno (ID_ORDENS_VENDA).
 *   2) POST /api/v1/map/geocode { orderIds: [<idInterno>] }.
 *   3) GET /api/v1/map/orders?date=<date> — verifica se o pedido
 *      passou a ter coordenadas.
 *
 * Exit codes:
 *   0 = pedido resolvido; 2 = pedido não resolveu; 3 = erro fatal.
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

const orderNumber = Number(process.argv[2]);
if (!Number.isInteger(orderNumber) || orderNumber <= 0) {
  console.error("Uso: node scripts/test-geocode.js <orderNumber> [YYYY-MM-DD]");
  process.exit(1);
}
const date = process.argv[3] || new Date().toISOString().slice(0, 10);

function sign(method, urlPath, bodyStr) {
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(12).toString("hex");
  const bodyHash = crypto.createHash("sha256").update(bodyStr || "").digest("hex");
  const canonical = [method, urlPath, ts, nonce, bodyHash].join("\n");
  const sig = crypto.createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");
  return {
    "x-api-key": API_KEY,
    "x-timestamp": ts,
    "x-nonce": nonce,
    "x-signature": sig,
  };
}
function redact(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = k === "x-api-key" || k === "x-signature" ? "[REDACTED]" : v;
  }
  return out;
}
async function call(method, urlPath, bodyObj) {
  const bodyStr = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
  const headers = sign(method, urlPath, bodyStr);
  if (bodyObj !== undefined) headers["content-type"] = "application/json";
  const started = Date.now();
  const res = await fetch(`${API_BASE_URL}${urlPath}`, {
    method,
    headers,
    body: bodyObj === undefined ? undefined : bodyStr,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return {
    method,
    url: urlPath,
    status: res.status,
    elapsedMs: Date.now() - started,
    headers: redact(headers),
    body: bodyObj ?? null,
    json,
  };
}
function locOf(o) {
  return {
    source: o?.location?.source,
    latitude: o?.location?.latitude,
    longitude: o?.location?.longitude,
    errorCode: o?.location?.errorCode ?? null,
  };
}

(async () => {
  try {
    console.log(`\n═══ 1) GET inicial — date=${date} ═══`);
    const g1 = await call("GET", `/api/v1/map/orders?date=${encodeURIComponent(date)}`);
    console.log("Status:", g1.status, "elapsedMs:", g1.elapsedMs);
    if (g1.status !== 200) {
      console.log(JSON.stringify(g1.json, null, 2));
      process.exit(3);
    }
    const orders = g1.json?.data?.orders || [];
    const target = orders.find((o) => Number(o.orderNumber) === orderNumber);
    if (!target) {
      console.error(`[erro] Pedido N_PEDIDO=${orderNumber} não encontrado em ${date}.`);
      process.exit(3);
    }
    console.log("Antes:", JSON.stringify({
      orderId: target.orderId,
      orderNumber: target.orderNumber,
      addressFormatted: target.address?.formatted,
      location: locOf(target),
    }, null, 2));

    console.log(`\n═══ 2) POST /api/v1/map/geocode { orderIds:[${target.orderId}] } ═══`);
    const p = await call("POST", "/api/v1/map/geocode", { orderIds: [target.orderId] });
    console.log("Status:", p.status, "elapsedMs:", p.elapsedMs);
    console.log(JSON.stringify(p.json, null, 2));

    console.log(`\n═══ 3) GET final — date=${date} ═══`);
    const g2 = await call("GET", `/api/v1/map/orders?date=${encodeURIComponent(date)}`);
    const after = (g2.json?.data?.orders || []).find(
      (o) => Number(o.orderId) === Number(target.orderId),
    );
    console.log("Depois:", JSON.stringify({
      orderId: after?.orderId,
      orderNumber: after?.orderNumber,
      location: locOf(after),
    }, null, 2));

    const ok =
      after &&
      typeof after.location?.latitude === "number" &&
      typeof after.location?.longitude === "number";
    console.log(`\nResultado: ${ok ? "RESOLVIDO ✓" : "NÃO RESOLVIDO ✗"}`);
    process.exit(ok ? 0 : 2);
  } catch (err) {
    console.error("[fatal]", err?.stack || err);
    process.exit(3);
  }
})();
