"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./pricing.controller");

const router = Router();

// Somente leitura. HMAC obrigatório.
router.get("/resolve", authMiddleware, controller.resolvePrice);

module.exports = router;