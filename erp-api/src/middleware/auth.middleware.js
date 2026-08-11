"use strict";

const crypto = require("crypto");
const { env } = require("../config/env");
const { logger } = require("../config/logger");

// Tolerância de tempo (em ms) para timestamp
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutos

// Cache de nonces já vistos (proteção anti-replay).
// Em produção real, substituir por Redis. Nesta v1.0.0, in-memory basta.
const nonceCache = new Map();
const NONCE_TTL_MS = TIMESTAMP_TOLERANCE_MS * 2;

function rememberNonce(nonce) {
  const now = Date.now();
  // GC preguiçoso
  if (nonceCache.size > 10000) {
    for (const [k, exp] of nonceCache) {
      if (exp < now) nonceCache.delete(k);
    }
  }
  nonceCache.set(nonce, now + NONCE_TTL_MS);
}

function nonceSeen(nonce) {
  const exp = nonceCache.get(nonce);
  if (!exp) return false;
  if (exp < Date.now()) {
    nonceCache.delete(nonce);
    return false;
  }
  return true;
}

function logAuthRejected(req, reason, extra = {}) {
  logger.warn(
    {
      requestId: req.requestId,
      reason,
      ...extra,
    },
    "Authentication rejected",
  );
}

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Não autorizado.",
      retryable: false,
    },
  });
}

function isLocalhost(req) {
  // Usa SEMPRE o socket remoto real; nunca confia em x-forwarded-for.
  const raw =
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress) ||
    "";
  return (
    raw === "127.0.0.1" ||
    raw === "::1" ||
    raw === "::ffff:127.0.0.1" ||
    raw.startsWith("127.")
  );
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function computeSignature({ method, path, timestamp, nonce, bodyHash, secret }) {
  const canonical = [method.toUpperCase(), path, timestamp, nonce, bodyHash].join("\n");
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

function authMiddleware(req, res, next) {
  // Bypass exclusivo de desenvolvimento local ou testes
  if (process.env.SKIP_AUTH_FOR_TEST === "true") {
    return next();
  }
  if (env.NODE_ENV !== "production" && env.DEV_BYPASS_AUTH && isLocalhost(req)) {
    logger.debug({ requestId: req.requestId }, "auth bypass (localhost dev)");
    return next();
  }

  const apiKey = req.header("x-api-key");
  const timestamp = req.header("x-timestamp");
  const nonce = req.header("x-nonce");
  const signature = req.header("x-signature");

  if (!apiKey || !timestamp || !nonce || !signature) {
    logAuthRejected(req, "missing_api_key", {
      hasApiKey: !!apiKey,
      hasTimestamp: !!timestamp,
      hasNonce: !!nonce,
      hasSignature: !!signature,
    });
    return unauthorized(res);
  }
  if (!env.API_KEY || !env.HMAC_SECRET) {
    // Config incompleta em produção já é bloqueada na env; aqui é defesa em profundidade.
    logAuthRejected(req, "unauthorized", {
      hasConfiguredApiKey: !!env.API_KEY,
      hasConfiguredHmacSecret: !!env.HMAC_SECRET,
    });
    return unauthorized(res);
  }

  // API key check (constant-time)
  if (!timingSafeEqualStr(apiKey, env.API_KEY)) {
    logAuthRejected(req, "invalid_api_key");
    return unauthorized(res);
  }

  // Timestamp (ms since epoch)
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    logAuthRejected(req, "invalid_timestamp");
    return unauthorized(res);
  }
  if (Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    logAuthRejected(req, "timestamp_out_of_range");
    return unauthorized(res);
  }

  // Nonce anti-replay
  if (typeof nonce !== "string" || nonce.length < 8 || nonce.length > 128) {
    logAuthRejected(req, "invalid_request", {
      invalidField: "nonce",
    });
    return unauthorized(res);
  }
  if (nonceSeen(nonce)) {
    logAuthRejected(req, "nonce_replay");
    return unauthorized(res);
  }

  // Body hash
  const rawBody =
    req.method === "GET" || req.method === "HEAD"
      ? ""
      : req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : "";
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  const expected = computeSignature({
    method: req.method,
    // Path INCLUI querystring, exatamente como recebido (originalUrl).
    path: req.originalUrl,
    timestamp,
    nonce,
    bodyHash,
    secret: env.HMAC_SECRET,
  });

  if (!timingSafeEqualStr(signature, expected)) {
    logAuthRejected(req, "invalid_signature");
    return unauthorized(res);
  }

  rememberNonce(nonce);
  return next();
}

module.exports = { authMiddleware, computeSignature };