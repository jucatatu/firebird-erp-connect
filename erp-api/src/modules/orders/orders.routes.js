"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./orders.controller");

const router = Router();

// POST /api/v1/orders — criação de Ordem de Venda no ERP.
// - Autenticação HMAC obrigatória (mesmo protocolo dos demais endpoints).
// - Idempotency-Key obrigatória (validada no service).
// - Transação Firebird única; rollback integral em qualquer erro.
router.post("/", authMiddleware, controller.createOrder);
router.get("/batch-status", authMiddleware, controller.getBatchStatus);
router.get("/:orderNumber", authMiddleware, controller.getOrder);
router.put("/:orderNumber", authMiddleware, controller.updateOrder);

module.exports = router;