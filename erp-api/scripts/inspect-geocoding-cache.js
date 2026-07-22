#!/usr/bin/env node
"use strict";
/**
 * Inspeciona o cache de geocodificação DENTRO DO PRÓPRIO PROCESSO deste
 * script. IMPORTANTE:
 *
 *   • Cada execução deste script cria um processo Node novo.
 *   • Esse processo tem seu próprio heap, seu próprio singleton e seu
 *     próprio `Map` de cache — SEMPRE começa vazio.
 *   • Rodar `node scripts/inspect-geocoding-cache.js` (mesmo via
 *     `pm2 exec ...`) NÃO acessa o cache da instância da API que já
 *     está rodando no PM2. É outro processo, outra memória.
 *
 * Para inspecionar o cache real da API em execução use o endpoint
 * autenticado GET /api/v1/health/geocoding/cache/:orderId, protegido
 * pela flag GEOCODING_DIAGNOSTICS_ENABLED.
 *
 * Este script é útil apenas para:
 *   - consultar o pedido no Firebird;
 *   - montar o endereço canônico;
 *   - calcular o cacheKey (invariante compartilhada com o servidor);
 *   - conferir provider/configuração do processo deste script.
 *
 * Uso: node scripts/inspect-geocoding-cache.js <orderId>
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
    cacheScope: "current_script_process_only",
    sharedWithRunningApi: false,
    cacheKind: cache.kind,
    pid: process.pid,
    pm2Instance: process.env.NODE_APP_INSTANCE ?? null,
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
          providerResolvedAt: entry.providerResolvedAt || null,
          updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
        }
      : null,
    note:
      "Este script roda em um processo Node INDEPENDENTE. Nunca compartilha memória com a instância da API em execução (PM2 ou não). Para consultar o cache real do servidor use GET /api/v1/health/geocoding/cache/:orderId com GEOCODING_DIAGNOSTICS_ENABLED=true.",
  }, null, 2));
  process.exit(0);
})().catch((err) => { console.error("[fatal]", err?.stack || err); process.exit(3); });
