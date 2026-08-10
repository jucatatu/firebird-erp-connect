"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const service = require("./payment-options.service");

const getOptions = asyncHandler(async (req, res) => {
  const data = await service.getPaymentOptions();
  return success(res, data);
});

module.exports = {
  getOptions
};
