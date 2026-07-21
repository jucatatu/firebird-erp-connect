"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./health.controller");

const router = Router();

// Público
router.get("/", controller.getHealth);

// Autenticado (com bypass local em dev)
router.get("/erp", authMiddleware, controller.getErpHealth);

module.exports = router;