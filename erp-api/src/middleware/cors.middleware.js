"use strict";

const cors = require("cors");
const { env } = require("../config/env");

function corsMiddleware() {
  const allowlist = env.CORS_ORIGINS_LIST;

  return cors({
    origin(origin, callback) {
      // Permite requests sem origin (curl, health-checks internos)
      if (!origin) return callback(null, true);
      if (allowlist.length === 0) {
        // Sem allowlist: em prod bloqueia, em dev libera
        if (env.NODE_ENV === "production") return callback(new Error("CORS bloqueado"), false);
        return callback(null, true);
      }
      if (allowlist.includes(origin)) return callback(null, true);
      return callback(new Error("CORS bloqueado"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-api-key",
      "x-timestamp",
      "x-nonce",
      "x-signature",
      "x-request-id",
    ],
    exposedHeaders: ["x-request-id"],
  });
}

module.exports = { corsMiddleware };