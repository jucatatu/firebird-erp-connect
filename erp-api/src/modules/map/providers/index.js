"use strict";

const { env } = require("../../../config/env");
const { logger } = require("../../../config/logger");
const { createFakeProvider } = require("./fake.provider");
const { createGoogleProvider } = require("./google.provider");

/**
 * Validação de configuração de provider por ambiente.
 *
 *   NODE_ENV        | fake             | google sem chave
 *   ----------------|------------------|--------------------
 *   test            | permitido        | erro                (test config injeta fake)
 *   development     | permitido (WARN) | erro                (env schema rejeita)
 *   production      | ERRO             | ERRO                (env schema rejeita)
 *
 * A checagem principal roda no env.js (superRefine). Esta função é chamada
 * no boot para emitir avisos claros e ficar como segunda barreira.
 */
function assertProviderConfig() {
  const { NODE_ENV, GEOCODING_PROVIDER, GOOGLE_GEOCODING_API_KEY } = env;

  if (GEOCODING_PROVIDER === "google" && !GOOGLE_GEOCODING_API_KEY) {
    throw new Error(
      "GEOCODING_PROVIDER=google requer GOOGLE_GEOCODING_API_KEY configurada.",
    );
  }
  if (NODE_ENV === "production" && GEOCODING_PROVIDER === "fake") {
    throw new Error(
      "GEOCODING_PROVIDER=fake é proibido em produção. Configure 'google'.",
    );
  }
  if (NODE_ENV !== "test" && GEOCODING_PROVIDER === "fake") {
    logger.warn(
      { provider: "fake", env: NODE_ENV },
      "AVISO: usando provider de geocodificação FAKE (sem chamada externa).",
    );
  }
}

/**
 * Descreve a configuração atual — seguro para expor em endpoints
 * autenticados de diagnóstico. Nunca revela a chave.
 */
function describeProvider() {
  return {
    provider: env.GEOCODING_PROVIDER,
    configured:
      env.GEOCODING_PROVIDER === "fake"
        ? true
        : Boolean(env.GOOGLE_GEOCODING_API_KEY),
    keyPresent: Boolean(env.GOOGLE_GEOCODING_API_KEY),
  };
}

/**
 * Seleciona uma instância de provider. `explicit` (para testes) tem precedência.
 * Nunca cai silenciosamente em `fake` fora de test.
 */
function pickProvider(explicit) {
  if (explicit) return explicit;
  if (env.GEOCODING_PROVIDER === "google") return createGoogleProvider();
  if (env.GEOCODING_PROVIDER === "fake") return createFakeProvider();
  throw new Error(`Provider desconhecido: ${env.GEOCODING_PROVIDER}`);
}

module.exports = { assertProviderConfig, describeProvider, pickProvider };
