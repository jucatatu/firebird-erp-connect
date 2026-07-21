"use strict";

const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Muitas requisições. Tente novamente em instantes.",
        retryable: true,
      },
    });
  },
});

module.exports = { globalRateLimit };