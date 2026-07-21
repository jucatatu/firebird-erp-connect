"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { env } = require("../../config/env");
const service = require("./health.service");
const pkg = require("../../../package.json");

const getHealth = (_req, res) =>
  success(res, {
    service: "erp-api",
    status: "ok",
    version: pkg.version,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });

const getErpHealth = asyncHandler(async (_req, res) => {
  await service.checkErp();
  return success(res, {
    status: "ok",
    database: "reachable",
    timestamp: new Date().toISOString(),
  });
});

module.exports = { getHealth, getErpHealth };