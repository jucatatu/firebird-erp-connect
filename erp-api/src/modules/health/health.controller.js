"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { env } = require("../../config/env");
const service = require("./health.service");
const pkg = require("../../../package.json");
const { describeProvider } = require("../map/providers");
const { getCache } = require("../map/geocoding-cache");
const mapRepository = require("../map/map.repository");
const opsMapper = require("../operations/operations.mapper");
const { normalizeAddress } = require("../map/geocoding-normalize");

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
    pm2Instance: process.env.NODE_APP_INSTANCE ?? null,
    nodeEnv: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/health/geocoding/cache/:orderId
 * Diagnóstico do cache in-memory DO PROCESSO que atendeu a requisição.
 * Só responde quando GEOCODING_DIAGNOSTICS_ENABLED=true; caso contrário,
 * retorna 404 (não expõe existência do endpoint em produção).
 * Nunca retorna latitude/longitude, placeId, chave, telefone, etc.
 */
const getGeocodingCacheDiagnostic = asyncHandler(async (req, res) => {
  if (!env.GEOCODING_DIAGNOSTICS_ENABLED) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Not found", retryable: false },
    });
  }
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "orderId inválido", retryable: false },
    });
  }
  const rows = await mapRepository.findOrdersAddressesByIds([orderId]);
  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: { code: "ORDER_NOT_FOUND", message: "Pedido não encontrado", retryable: false },
    });
  }
  const row = rows[0];
  const addr = opsMapper.mapAddress(row);
  const norm = normalizeAddress({
    street: addr.street,
    number: addr.number,
    complement: addr.complement,
    neighborhood: addr.neighborhood,
    city: addr.city,
    state: addr.state,
    postalCode: "",
  });
  const cache = getCache();
  const entry = await cache.get(norm.cacheKey);
  const orderNumber = Number(opsMapper.pick(row, "N_PEDIDO")) || null;
  return success(res, {
    cacheKind: cache.kind,
    pid: process.pid,
    pm2Instance: process.env.NODE_APP_INSTANCE ?? null,
    orderId,
    orderNumber,
    canonical: norm.canonical,
    cacheKey: norm.cacheKey,
    geocodable: norm.geocodable,
    entry: entry
      ? {
          status: entry.status,
          hasCoordinates:
            typeof entry.latitude === "number" &&
            typeof entry.longitude === "number",
          errorCode: entry.errorCode || null,
          attempts: entry.attempts || 0,
          precision: entry.precision || null,
          locationType: entry.locationType || null,
          providerResolvedAt: entry.providerResolvedAt || null,
          updatedAt: entry.updatedAt
            ? new Date(entry.updatedAt).toISOString()
            : null,
        }
      : null,
  });
});

module.exports = {
  getHealth,
  getErpHealth,
  getGeocodingHealth,
  getGeocodingCacheDiagnostic,
};