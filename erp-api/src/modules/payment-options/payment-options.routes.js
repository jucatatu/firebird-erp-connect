"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./payment-options.controller");

const router = Router();

router.get("/", authMiddleware, controller.getOptions);

module.exports = router;
