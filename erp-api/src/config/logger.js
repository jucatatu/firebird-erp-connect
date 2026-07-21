"use strict";

const pino = require("pino");
const { env } = require("./env");

const redactPaths = [
  'req.headers["x-api-key"]',
  'req.headers["x-signature"]',
  'req.headers["x-nonce"]',
  'req.headers.authorization',
  'req.headers.cookie',
  "*.API_KEY",
  "*.HMAC_SECRET",
  "*.FIREBIRD_PASSWORD",
  "*.password",
  "*.senha",
];

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "erp-api" },
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
});

module.exports = { logger };