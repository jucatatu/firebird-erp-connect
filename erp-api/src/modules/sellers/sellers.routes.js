"use strict";

const express = require("express");
const router = express.Router();
const sellersController = require("./sellers.controller");
const { authMiddleware } = require("../../middleware/auth.middleware");

router.get("/", authMiddleware, sellersController.handleSearch);
router.get("/:id", authMiddleware, sellersController.handleGetById);


module.exports = router;
