#!/usr/bin/env node
"use strict";
/**
 * Inspeciona o cache de geocodificação para o endereço de um pedido.
 * Uso: node scripts/inspect-geocoding-cache.js <orderId>
 *
 * Consulta o Firebird para montar o endereço canônico, calcula o cacheKey
 * e imprime o que existe no cache in-memory do processo atual (limitado
 * pelo escopo: cache in-memory não persiste entre processos).
 */
const path = require("path");
try { require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") }); } catch {}

const orderId = Number(process.argv[2]);
if (!Number.isInteger(orderId) || orderId <= 0) {
  console.error("Uso: node scripts/inspect-geocoding-cache.js <orderId>");
  process.exit(1);
}

(async () => {
  const mapRepo = require("../src/modules/map/map.repository");
  const opsMapper = require("../src/modules/operations/operations.mapper");
  const { normalizeAddress } = require("../src/modules/map/geocoding-normalize");
  const { getCache } = require("../src/modules/map/geocoding-cache");
  const { describeProvider } = require("../src/modules/map/providers");

  const rows = await mapRepo.findOrdersAddressesByIds([orderId]);
  if (rows.length === 0) {
    console.error(`Pedido id=${orderId} não encontrado.`);
    process.exit(2);
  }
  const addr = opsMapper.mapAddress(rows[0]);
  const norm = normalizeAddress({
    street: addr.street, number: addr.number, complement: addr.complement,
    neighborhood: addr.neighborhood, city: addr.city, state: addr.state, postalCode: "",
  });
  const cache = getCache();
  const entry = await cache.get(norm.cacheKey);
  console.log(JSON.stringify({
    cacheKind: cache.kind,
    pid: process.pid,
    provider: describeProvider(),
    canonical: norm.canonical,
    cacheKey: norm.cacheKey,
    geocodable: norm.geocodable,
    entry: entry
      ? {
          status: entry.status,
          errorCode: entry.errorCode || null,
          hasCoordinates:
            typeof entry.latitude === "number" && typeof entry.longitude === "number",
          precision: entry.precision || null,
          locationType: entry.locationType || null,
          attempts: entry.attempts || 0,
          updatedAt: entry.updatedAt || null,
        }
      : null,
    note:
      "Cache é in-memory por processo. Se você rodar este script fora do processo PM2 do erp-api, verá cache VAZIO — isso é esperado. Use GET /api/v1/health/geocoding para conferir o PID do servidor.",
  }, null, 2));
  process.exit(0);
})().catch((err) => { console.error("[fatal]", err?.stack || err); process.exit(3); });
