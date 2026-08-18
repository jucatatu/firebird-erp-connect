"use strict";

const express = require("express");
const router = express.Router();
const sellersController = require("./sellers.controller");
const { authMiddleware } = require("../../middleware/auth.middleware");

router.get("/", authMiddleware, sellersController.handleSearch);

module.exports = router;
