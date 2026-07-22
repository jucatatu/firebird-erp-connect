"use strict";

const crypto = require("crypto");

const firebird = require("../../shared/database/firebird-client");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");
const {
  getStore,
  hashPayload,
  buildEntry,
  assertProductionReady,
} = require("../../shared/idempotency/idempotency-store");

const mapper = require("./orders.mapper");
const repository = require("./orders.repository");

function sanitizedErrorLog(err) {
  if (!err) return { message: "unknown" };
  return { code: err.code, name: err.name, message: err.message };
}

/**
 * Mutex global in-process: serializa TODAS as criações de ordens.
 *
 * Motivo: SP_CAD_ORDEM_VENDA lê o ID recém-inserido via
 *   GEN_ID(GEN_ORDENS_VENDA_ID, 0)
 * Como o generator é global, duas criações simultâneas podem interferir
 * na leitura do ID entre INSERT e leitura.
 *
 * Diferente do lock por Idempotency-Key (que protege retries da MESMA
 * operação): este lock serializa criações DISTINTAS.
 *
 * IMPORTANTE: escopo é o PROCESSO Node atual. Alvo suportado hoje é
 * PM2 single-instance. Em cluster/multi-instância será necessário um
 * lock distribuído (ex.: SELECT ... WITH LOCK em tabela de coordenação
 * no próprio Firebird, ou Redis).
 */
let globalChain = Promise.resolve();
async function withGlobalOrderLock(fn) {
  const prev = globalChain;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  globalChain = prev.then(() => gate);
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

/**
 * Executa a criação real da ordem dentro de UMA transação Firebird.
 *
 * Etapas:
 *   1. Resolver companyId oficial (payload → cliente → grupo → fallback).
 *   2. SP_CAD_ORDEM_VENDA_COMPLETO com CHAVE=NULL e GERA_COBRANCA=1.
 *   3. Para cada item, SP_CAD_ITENS_ORDENS_VENDA com CHAVE='I'.
 *   4. Para cada equipamento, SP_CAD_EQUIP_ORDENS_VENDA com CHAVE='I'.
 *   5. SELECT ORDENS_VENDA para retornar ID e N_PEDIDO reais.
 *   6. COMMIT (feito pelo withTransaction em caso de retorno normal).
 *
 * Qualquer exceção → ROLLBACK integral (garantido por withTransaction).
 */
async function createOrderTransactional({ payload, correlationId }) {
  return withGlobalOrderLock(() => firebird.withTransaction(async (tx) => {
    const t0 = Date.now();
    logger.info({ correlationId, cadUser: mapper.CAD_USER }, "orders.create: início");

    // 1. Resolução oficial de empresa.
    let companyContext = null;
    if (payload.companyId !== 1 && payload.companyId !== 3) {
      companyContext = await repository.fetchClientCompanyContext(
        tx,
        payload.customerId,
      );
    }
    const companyId = mapper.resolveCompanyId(
      payload.companyId,
      companyContext ? Number(companyContext.CLIENTE_ID_EMPRESA) : null,
      companyContext ? companyContext.GRUPO_DESCRICAO : null,
    );

    // 2. Cabeçalho.
    const completeParams = mapper.buildCompleteProcParams({
      payload,
      companyId,
    });
    logger.info(
      { correlationId, step: "SP_CAD_ORDEM_VENDA_COMPLETO" },
      "orders.create: executando procedure principal",
    );
    const orderId = await repository.callCreateOrderComplete(tx, completeParams);
    logger.info(
      { correlationId, step: "SP_CAD_ORDEM_VENDA_COMPLETO", orderId },
      "orders.create: procedure principal retornou ID",
    );

    // 3. Itens.
    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      const params = mapper.buildItemProcParams(orderId, item);
      await repository.callAddItem(tx, params);
      logger.info(
        { correlationId, step: "SP_CAD_ITENS_ORDENS_VENDA", index: i, orderId },
        "orders.create: item incluído",
      );
    }

    // 4. Equipamentos.
    for (let i = 0; i < payload.equipment.length; i++) {
      const eq = payload.equipment[i];
      const params = mapper.buildEquipmentProcParams(orderId, eq);
      await repository.callAddEquipment(tx, params);
      logger.info(
        { correlationId, step: "SP_CAD_EQUIP_ORDENS_VENDA", index: i, orderId },
        "orders.create: equipamento incluído",
      );
    }

    // 5. Confirmar dados finais do pedido.
    const created = await repository.fetchCreatedOrder(tx, orderId);
    if (!created) {
      throw new AppError({
        message: "Pedido criado mas não pôde ser confirmado.",
        statusCode: 500,
        code: "ORDER_CONFIRMATION_FAILED",
        retryable: false,
      });
    }

    const finalCompanyId = Number(created.ID_EMPRESA);
    const persistedCompanyId =
      finalCompanyId === 1 || finalCompanyId === 3 ? finalCompanyId : companyId;

    const result = {
      id: Number(created.ID_ORDENS_VENDA),
      orderNumber: Number(created.N_PEDIDO),
      companyId: persistedCompanyId,
      status: created.STATUS_DESCRICAO
        ? String(created.STATUS_DESCRICAO).trim() || null
        : null,
    };

    logger.info(
      {
        correlationId,
        orderId: result.id,
        orderNumber: result.orderNumber,
        companyId: result.companyId,
        durationMs: Date.now() - t0,
      },
      "orders.create: commit",
    );

    return result;
  })).catch((err) => {
    // Sanitiza qualquer erro cru do driver ANTES de subir.
    if (err instanceof AppError) {
      logger.warn(
        { correlationId, code: err.code, statusCode: err.statusCode },
        "orders.create: rollback",
      );
      throw err;
    }
    logger.error(
      { correlationId, err: sanitizedErrorLog(err) },
      "orders.create: rollback por erro não tratado",
    );
    throw new AppError({
      message: "Falha ao criar pedido no ERP.",
      statusCode: 500,
      code: "ORDER_CREATE_FAILED",
      retryable: false,
    });
  });
}

/**
 * Camada de idempotência em torno da criação. Semânticas:
 *   - Mesma chave + mesmo payload → retorna resultado anterior.
 *   - Mesma chave + payload diferente → 409 IDEMPOTENCY_CONFLICT.
 *   - Duas execuções concorrentes → serializadas via withLock (in-process).
 *   - Produção exige store persistente (IDEMPOTENCY_STORE=file).
 */
async function createOrder({ payload, idempotencyKey, rawBody, correlationId }) {
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new AppError({
      message: "Header Idempotency-Key é obrigatório.",
      statusCode: 400,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      retryable: false,
    });
  }
  assertProductionReady();

  const key = idempotencyKey.trim();
  const requestHash = hashPayload(rawBody);
  const store = getStore();
  await store.init();

  return store.withLock(key, async () => {
    const existing = await store.get(key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError({
          message: "Idempotency-Key já usada com payload diferente.",
          statusCode: 409,
          code: "IDEMPOTENCY_CONFLICT",
          retryable: false,
        });
      }
      logger.info(
        { correlationId, idempotencyKey: key },
        "orders.create: replay via idempotency",
      );
      return { replayed: true, order: existing.body.order, status: existing.status };
    }

    const order = await createOrderTransactional({ payload, correlationId });
    const body = { success: true, order };
    await store.put(key, buildEntry({ requestHash, status: 201, body }));
    return { replayed: false, order, status: 201 };
  });
}

function newCorrelationId() {
  return crypto.randomUUID();
}

module.exports = {
  createOrder,
  createOrderTransactional,
  newCorrelationId,
};