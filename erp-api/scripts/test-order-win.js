"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");

/**
 * Script de teste para Windows (Node.js).
 * Uso: node scripts/test-order-win.js <API_KEY> <HMAC_SECRET> [payload.json]
 */

const apiKey = process.argv[2];
const secret = process.argv[3];
const payloadPath = process.argv[4] || "payload.json";

if (!apiKey || !secret) {
  console.error("Uso: node scripts/test-order-win.js <API_KEY> <HMAC_SECRET> [payload.json]");
  process.exit(1);
}

const payloadParsed = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const payloadStringified = JSON.stringify(payloadParsed);
const bodyHash = crypto.createHash("sha256").update(payloadStringified).digest("hex");
const timestamp = Date.now().toString();
const nonce = crypto.randomBytes(12).toString("hex");
const method = "POST";
const path = "/api/v1/orders";

const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");
const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");

const options = {
  hostname: "localhost",
  port: 3052,
  path: path,
  method: method,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": signature,
    "idempotency-key": "homolog-win-" + crypto.randomUUID().slice(0, 8),
  },
};

const req = http.request(options, (res) => {
  let data = "";
  console.log("Status Code:", res.statusCode);
  console.log("Correlation-Id:", res.headers["x-correlation-id"]);
  
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    try {
      console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log("Raw Response:", data);
    }
  });
});

req.on("error", (e) => {
  console.error("Erro na requisição:", e.message);
});

req.write(payloadStringified);
req.end();
