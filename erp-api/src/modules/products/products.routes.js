"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./products.controller");

const router = Router();

// Somente leitura. HMAC obrigatório.
router.get("/", authMiddleware, controller.listProducts);
router.get("/:productId", authMiddleware, controller.getProduct);

module.exports = router;