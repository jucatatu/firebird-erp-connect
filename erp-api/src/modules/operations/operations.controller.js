"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateListOrdersQuery } = require("./operations.validator");
const service = require("./operations.service");

const listOrders = asyncHandler(async (req, res) => {
  const { date, companies } = validateListOrdersQuery(req.query);
  const data = await service.listOrdersForDelivery({ date, companies });
  return success(res, data);
});

module.exports = { listOrders };