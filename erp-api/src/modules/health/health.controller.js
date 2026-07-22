"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { env } = require("../../config/env");
const service = require("./health.service");
const pkg = require("../../../package.json");
const { describeProvider } = require("../map/providers");
const { getCache } = require("../map/geocoding-cache");

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

const getGeocodingHealth = asyncHandler(async (_req, res) => {
  const desc = describeProvider();
  const cache = getCache();
  return success(res, {
    ...desc,
    cacheKind: cache.kind,
    pid: process.pid,
    nodeEnv: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

module.exports = { getHealth, getErpHealth, getGeocodingHealth };