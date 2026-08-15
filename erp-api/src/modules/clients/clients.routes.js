"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./clients.controller");

const router = Router();

// Somente leitura. HMAC obrigatório (mesmo bypass local já existente).
router.get("/", authMiddleware, controller.listClients);
router.get("/:clientId", authMiddleware, controller.getClient);
router.post("/", authMiddleware, controller.createClient);

module.exports = router;
