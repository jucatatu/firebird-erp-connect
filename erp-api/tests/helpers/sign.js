"use strict";

const crypto = require("crypto");

function sign({ method, path, body, apiKey, secret, timestamp, nonce }) {
  const ts = String(timestamp ?? Date.now());
  const nc = nonce ?? crypto.randomBytes(12).toString("hex");
  const raw =
    method === "GET" || method === "HEAD"
      ? ""
      : body && Object.keys(body).length > 0
        ? JSON.stringify(body)
        : "";
  const bodyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const canonical = [method.toUpperCase(), path, ts, nc, bodyHash].join("\n");
  const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  return {
    headers: {
      "x-api-key": apiKey,
      "x-timestamp": ts,
      "x-nonce": nc,
      "x-signature": signature,
    },
    nonce: nc,
    timestamp: ts,
  };
}

module.exports = { sign };