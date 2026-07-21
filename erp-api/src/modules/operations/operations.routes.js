"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./operations.controller");

const router = Router();

// GET /api/v1/operations/orders — listagem de pedidos para entrega.
// Autenticação HMAC obrigatória (bypass local conforme regra existente).
// Somente leitura.
router.get("/orders", authMiddleware, controller.listOrders);

module.exports = router;