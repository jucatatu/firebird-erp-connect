"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateMapOrdersQuery, validateGeocodeBody } = require("./map.validator");
const service = require("./map.service");

const listOrdersForMap = asyncHandler(async (req, res) => {
  const { date, companyId } = validateMapOrdersQuery(req.query);
  const data = await service.listOrdersForMap({ date, companyId });
  return success(res, data);
});

const geocodeOrders = asyncHandler(async (req, res) => {
  const { orderIds, limit } = validateGeocodeBody(req.body || {});
  const data = await service.geocodeByOrderIds({ orderIds, limit });
  return success(res, data);
});

module.exports = { listOrdersForMap, geocodeOrders };
