"use strict";

const { Router } = require("express");
const rateLimit = require("express-rate-limit");

const { authMiddleware } = require("../../middleware/auth.middleware");
const { env } = require("../../config/env");
const controller = require("./map.controller");

const router = Router();

// GET /api/v1/map/orders — leitura pura (Firebird + cache). Não gera custo externo.
router.get("/orders", authMiddleware, controller.listOrdersForMap);

// POST /api/v1/map/geocode — pode gerar custo externo. Auth HMAC obrigatória
// (é a mesma barreira usada em toda a API — a política de autorização deste
// endpoint é: qualquer chamador autenticado da integração pode disparar,
// limitado por rate limit + limite por requisição definido no validator).
const geocodeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(1, Math.floor(env.RATE_LIMIT_MAX / 5)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Muitas resoluções em curto período. Tente novamente em instantes.",
        retryable: true,
      },
    });
  },
});

router.post("/geocode", geocodeLimiter, authMiddleware, controller.geocodeOrders);

module.exports = router;
