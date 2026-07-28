"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./equipment-types.controller");

const router = Router();

// Somente leitura. HMAC obrigatório.
router.get("/", authMiddleware, controller.listEquipmentTypes);

module.exports = router;