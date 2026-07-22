"use strict";

const operationsService = require("../operations/operations.service");
const mapRepository = require("./map.repository");
const opsMapper = require("../operations/operations.mapper");
const { normalizeAddress } = require("./geocoding-normalize");
const { getCache } = require("./geocoding-cache");
const geocoding = require("./geocoding.service");
const { logger } = require("../../config/logger");
const { env } = require("../../config/env");

/**
 * Adapta o endereço do contrato Operations para os campos que o normalize
 * espera. NÃO inclui postalCode enquanto a coluna ORDENS_VENDA.CEP não é
 * confirmada via scripts/inspect-firebird-column.js.
 */
function fieldsFromOrder(order) {
  return {
    street: order.address?.street || "",
    number: order.address?.number || "",
    complement: order.address?.complement || "",
    neighborhood: order.address?.neighborhood || "",
    city: order.address?.city || "",
    state: order.address?.state || "",
    postalCode: "",
  };
}

function locationFromEntry(entry, cacheKey) {
  if (!entry) {
    return {
      latitude: null,
      longitude: null,
      locationType: "",
      precision: "",
      placeId: "",
      matchMismatch: false,
      source: "pending",
      errorCode: null,
      cacheKey,
    };
  }
  if (entry.status === "resolved") {
    return {
      latitude: entry.latitude ?? null,
      longitude: entry.longitude ?? null,
      locationType: entry.locationType || "",
      precision: entry.precision || "",
      placeId: entry.placeId || "",
      matchMismatch: Boolean(entry.matchMismatch),
      source: "cache",
      errorCode: null,
      cacheKey,
    };
  }
  if (entry.status === "unresolved" || entry.status === "skipped") {
    return {
      latitude: null,
      longitude: null,
      locationType: entry.locationType || "",
      precision: "",
      placeId: entry.placeId || "",
      matchMismatch: Boolean(entry.matchMismatch),
      source: "unresolved",
      errorCode: entry.errorCode || null,
      cacheKey,
    };
  }
  if (entry.status === "error") {
    return {
      latitude: null,
      longitude: null,
      locationType: "",
      precision: "",
      placeId: entry.placeId || "",
      matchMismatch: false,
      source: "error",
      errorCode: entry.errorCode || "PROVIDER_ERROR",
      cacheKey,
    };
  }
  // pending / desconhecido
  return {
    latitude: null,
    longitude: null,
    locationType: "",
    precision: "",
    placeId: entry.placeId || "",
    matchMismatch: false,
    source: "pending",
    errorCode: null,
    cacheKey,
  };
}

/**
 * GET /api/v1/map/orders — SOMENTE LEITURA (Firebird + cache).
 * Nunca chama provider.
 */
async function listOrdersForMap({ date, companyId }) {
  const base = await operationsService.listOrdersForDelivery({
    date,
    companies: companyId ? [companyId] : [1, 3],
    companiesProvided: Boolean(companyId),
  });

  const cache = getCache();
  let mapped = 0;
  let pending = 0;
  let unresolved = 0;
  let errors = 0;

  const enriched = [];
  for (const order of base.orders) {
    const norm = normalizeAddress(fieldsFromOrder(order));
    let entry = null;
    let source = "pending";

    if (!norm.geocodable) {
      source = "unresolved";
      unresolved++;
    } else {
      entry = await cache.get(norm.cacheKey);
      if (entry && entry.status === "resolved") {
        mapped++;
        source = "cache";
      } else if (entry && (entry.status === "unresolved" || entry.status === "skipped")) {
        unresolved++;
        source = "unresolved";
      } else if (entry && entry.status === "error") {
        errors++;
        source = "error";
      } else {
        pending++;
        source = "pending";
      }
    }

    const location = locationFromEntry(entry, norm.cacheKey);
    if (!norm.geocodable) {
      location.source = "unresolved";
      location.errorCode = "NOT_GEOCODABLE";
    } else {
      location.source = source;
    }

    enriched.push({ ...order, location });
  }

  return {
    date,
    companyId: companyId ?? null,
    summary: {
      total: enriched.length,
      mapped,
      pending,
      unresolved,
      errors,
    },
    orders: enriched,
  };
}

/**
 * POST /api/v1/map/geocode — resolve endereços dos orderIds informados.
 * Nunca aceita endereço/coordenadas vindos do browser.
 */
async function geocodeByOrderIds({ orderIds, limit }, opts = {}) {
  const rows = await mapRepository.findOrdersAddressesByIds(orderIds);
  logger.info(
    {
      geocode: {
        provider: env.GEOCODING_PROVIDER,
        providerKey: env.GOOGLE_GEOCODING_API_KEY ? "configured" : "missing",
        cache: getCache().kind,
        pid: process.pid,
        requestedIds: orderIds,
        foundIds: rows.map((r) => Number(opsMapper.pick(r, "ID_ORDENS_VENDA"))).filter(Number.isFinite),
      },
    },
    "map.geocode: request received",
  );
  // rowByOrderId
  const byId = new Map();
  for (const row of rows) {
    const oid = Number(opsMapper.pick(row, "ID_ORDENS_VENDA"));
    if (Number.isFinite(oid)) byId.set(oid, row);
  }

  // Construir fieldsList em ordem dos orderIds pedidos, dedup por cacheKey.
  const fieldsList = [];
  const orderKey = new Map(); // orderId -> cacheKey
  const seenKeys = new Set();
  for (const id of orderIds) {
    const row = byId.get(id);
    if (!row) {
      orderKey.set(id, null);
      continue;
    }
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
    orderKey.set(id, norm.cacheKey);
    logger.info(
      {
        geocode: {
          orderId: id,
          cacheKey: norm.cacheKey,
          canonical: norm.canonical,
          geocodable: norm.geocodable,
        },
      },
      "map.geocode: canonical built",
    );
    if (seenKeys.has(norm.cacheKey)) continue;
    seenKeys.add(norm.cacheKey);
    if (fieldsList.length >= limit) continue;
    fieldsList.push({
      street: addr.street,
      number: addr.number,
      complement: addr.complement,
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      postalCode: "",
    });
  }

  const resultsByKey = await geocoding.resolveMany(fieldsList, {
    provider: opts.provider,
    timeoutMs: opts.timeoutMs,
    cache: opts.cache,
  });
  for (const [key, entry] of resultsByKey.entries()) {
    logger.info(
      {
        geocode: {
          cacheKey: key,
          status: entry.status,
          errorCode: entry.errorCode || null,
          hasCoords:
            typeof entry.latitude === "number" && typeof entry.longitude === "number",
          matchedCountry: entry.matchedCountry || null,
          matchedCity: entry.matchedCity || null,
          matchedState: entry.matchedState || null,
          precision: entry.precision || null,
        },
      },
      "map.geocode: provider result",
    );
  }

  const perOrder = [];
  let resolvedCount = 0;
  let pendingCount = 0;
  let unresolvedCount = 0;
  let errorCount = 0;

  for (const id of orderIds) {
    const key = orderKey.get(id);
    const row = byId.get(id);
    const orderNumber = row
      ? Number(opsMapper.pick(row, "N_PEDIDO")) || null
      : null;
    const addressAvailable = Boolean(row && key);
    if (!key) {
      perOrder.push({
        orderId: id,
        orderNumber,
        status: "not_found",
        source: null,
        cacheKey: null,
        addressAvailable: false,
        errorCode: "ORDER_NOT_FOUND",
        precision: null,
        locationType: null,
      });
      continue;
    }
    const entry = resultsByKey.get(key);
    // Se não estava na fatia processada, cai como pending explícito.
    if (!entry) {
      pendingCount++;
      perOrder.push({
        orderId: id,
        orderNumber,
        status: "pending",
        source: "pending",
        cacheKey: key,
        addressAvailable,
        errorCode: null,
        precision: null,
        locationType: null,
      });
      continue;
    }
    const status = entry.status;
    if (status === "resolved") resolvedCount++;
    else if (status === "unresolved" || status === "skipped") unresolvedCount++;
    else if (status === "pending") pendingCount++;
    else if (status === "error") errorCount++;

    const normalizedStatus = status === "skipped" ? "unresolved" : status;
    // Se resolveOne devolveu source="cache", este POST NÃO chamou o
    // provider (idempotência). Preservar essa distinção na resposta.
    let source;
    if (entry.source) {
      source = entry.source;
    } else if (normalizedStatus === "resolved") {
      source = "provider";
    } else if (normalizedStatus === "unresolved") {
      source = "unresolved";
    } else if (normalizedStatus === "error") {
      source = "error";
    } else {
      source = "pending";
    }

    perOrder.push({
      orderId: id,
      orderNumber,
      cacheKey: key,
      status: normalizedStatus,
      source,
      addressAvailable,
      precision: status === "resolved" ? entry.precision || null : null,
      locationType: status === "resolved" ? entry.locationType || null : null,
      providerResolvedAt: entry.providerResolvedAt || null,
      location:
        status === "resolved"
          ? {
              latitude: entry.latitude ?? null,
              longitude: entry.longitude ?? null,
              locationType: entry.locationType || "",
              precision: entry.precision || "",
              placeId: entry.placeId || "",
              matchMismatch: Boolean(entry.matchMismatch),
            }
          : null,
      errorCode: entry.errorCode || null,
    });
  }

  return {
    success: true,
    summary: {
      requested: orderIds.length,
      found: byId.size,
      resolved: resolvedCount,
      pending: pendingCount,
      unresolved: unresolvedCount,
      errors: errorCount,
    },
    results: perOrder,
  };
}

module.exports = { listOrdersForMap, geocodeByOrderIds, fieldsFromOrder };
