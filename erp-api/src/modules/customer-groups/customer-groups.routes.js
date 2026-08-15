"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../../middleware/auth.middleware");
const controller = require("./customer-groups.controller");

const router = Router();

router.get("/", authMiddleware, controller.listGroups);

module.exports = router;
