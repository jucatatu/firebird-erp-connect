"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateSearchQuery, validateProductId } = require("./products.validator");
const service = require("./products.service");

const listProducts = asyncHandler(async (req, res) => {
  const input = validateSearchQuery(req.query);
  const data = await service.searchProducts(input);
  return success(res, data);
});

const getProduct = asyncHandler(async (req, res) => {
  const productId = validateProductId(req.params.productId);
  const data = await service.getProductById(productId);
  return success(res, data);
});

module.exports = { listProducts, getProduct };