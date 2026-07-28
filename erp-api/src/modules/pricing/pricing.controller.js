"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateResolveQuery } = require("./pricing.validator");
const service = require("./pricing.service");

const resolvePrice = asyncHandler(async (req, res) => {
  const input = validateResolveQuery(req.query);
  const data = await service.resolvePrice(input);
  return success(res, data);
});

module.exports = { resolvePrice };