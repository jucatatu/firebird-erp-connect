"use strict";

const crypto = require("crypto");

const firebird = require("../../shared/database/firebird-client");
const { AppError } = require("../../shared/errors/app-error");
const { env } = require("../../config/env");
const { logger } = require("../../config/logger");
const {
  getStore,
  hashPayload,
  buildEntry,
  assertProductionReady,
} = require("../../shared/idempotency/idempotency-store");

const mapper = require("./orders.mapper");
const repository = require("./orders.repository");
const clientsService = require("../clients/clients.service");
const productsService = require("../products/products.service");
const pricingService = require("../pricing/pricing.service");
const equipmentService = require("../equipment-types/equipment-types.service");
const companyRule = require("../../shared/company/company-rule");

/**
 * Mutex global in-process para serializar criações de ordens.
 * Necessário enquanto o ID_ORDENS_VENDA depender de GEN_ID(..., 0) 
 * dentro da procedure sem lock distribuído.
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
 * Resolve e valida a empresa do pedido.
 */
async function resolveAndValidateCompany(tx, payload) {
  // 1. Obter contexto do cliente para resolução de empresa (grupo, empresa vinculada)
  const clientContext = await repository.fetchClientCompanyContext(tx, payload.clientId);
  
  const resolvedCompanyId = companyRule.resolveCompanyId({
    explicitCompanyId: payload.companyId,
    clientCompanyId: clientContext ? Number(clientContext.CLIENTE_ID_EMPRESA) : null,
    groupDescription: clientContext ? clientContext.GRUPO_DESCRICAO : null
  });

  // No Sprint 7, companyId deve ser 1 ou 3.
  if (resolvedCompanyId !== 1 && resolvedCompanyId !== 3) {
    throw new AppError({
      message: "Empresa resolvida inválida para operação.",
      statusCode: 403,
      code: "COMPANY_NOT_ALLOWED",
      retryable: false
    });
  }

  return resolvedCompanyId;
}

/**
 * Valida se o cliente existe e pode operar.
 */
async function validateClient(clientId) {
  // getClientById já lança CLIENT_NOT_FOUND (404) se não existir
  const client = await clientsService.getClientById(clientId);
  
  // Auditoria: Sprint 7 exige endereço disponível
  if (!client.address || !client.address.city || !client.address.state) {
    throw new AppError({
      message: "Cliente sem endereço completo para entrega.",
      statusCode: 422,
      code: "CLIENT_ADDRESS_INCOMPLETE",
      retryable: false
    });
  }

  return client;
}

/**
 * Valida produtos e resolve preços.
 */
async function validateProductsAndPricing(items, clientId) {
  const validatedItems = [];
  let subtotal = 0;

  for (const item of items) {
    // 1. Validar produto
    const product = await productsService.getProductById(item.productId);
    
    // 2. Verificar se está ativo (regra da Sprint 7)
    if (product.active === false) {
      throw new AppError({
        message: `Produto ${item.productId} está inativo.`,
        statusCode: 422,
        code: "PRODUCT_INACTIVE",
        retryable: false
      });
    }

    // 3. Resolver preço
    let unitPrice;
    let strategy;

    if (item.manualUnitPrice) {
      unitPrice = Number(item.manualUnitPrice);
      strategy = "manual";
      logger.info(
        { productId: item.productId, clientId, manualUnitPrice: unitPrice },
        "orders.pricing: usando preço manual informado pelo vendedor"
      );
    } else {
      const pricing = await pricingService.resolvePrice({
        productId: item.productId,
        clientId: clientId,
      });

      if (!pricing.priceFound) {
        throw new AppError({
          message: `Preço não encontrado para o produto ${item.productId}.`,
          statusCode: 422,
          code: "PRICE_NOT_FOUND",
          retryable: false,
        });
      }
      unitPrice = Number(pricing.unitPrice);
      strategy = pricing.strategy;
    }

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: unitPrice,
      strategy: strategy,
    });

    subtotal += unitPrice * item.quantity;
  }

  return { validatedItems, subtotal };
}

/**
 * Valida tipos de equipamento.
 */
async function validateEquipments(equipments) {
  if (!equipments || equipments.length === 0) return [];

  // Busca todos os tipos ativos
  const { equipmentTypes } = await equipmentService.listEquipmentTypes({ limit: 500, active: true });
  const activeIds = new Set(equipmentTypes.map(t => t.id));

  for (const eq of equipments) {
    if (!activeIds.has(eq.equipmentTypeId)) {
      throw new AppError({
        message: `Tipo de equipamento ${eq.equipmentTypeId} inválido ou inativo.`,
        statusCode: 404,
        code: "EQUIPMENT_NOT_FOUND",
        retryable: false
      });
    }
  }

  return equipments;
}

/**
 * Executa a criação real da ordem dentro de UMA transação Firebird.
 */
async function createOrderTransactional({ payload, correlationId }) {
  return withGlobalOrderLock(() => firebird.withTransaction(async (tx) => {
    const t0 = Date.now();
    logger.info({ correlationId, cadUser: mapper.CAD_USER }, "orders.create: início");

    // 1. Validar Cliente (Fora da transação para performance, mas relido dentro se necessário)
    // Para Sprint 7, fazemos check inicial.
    const client = await validateClient(payload.clientId);

    // 2. Validar Produtos e Resolver Preços
    const { validatedItems, subtotal } = await validateProductsAndPricing(payload.items, payload.clientId);

    // 3. Validar Equipamentos
    await validateEquipments(payload.equipments);

    // 4. Resolver Empresa (Dentro da transação para consistência)
    const companyId = await resolveAndValidateCompany(tx, payload);

    // 5. Calcular totais (Server-side)
    const total = subtotal + payload.freightValue;
    const totals = { subtotal, total };

    // 6. Criar Cabeçalho via SP_CAD_ORDEM_VENDA_COMPLETO
    const completeParams = mapper.buildCompleteProcParams({
      payload,
      companyId,
      clientContext: client,
      totals
    });

    logger.info({ correlationId, step: "SP_CAD_ORDEM_VENDA_COMPLETO" }, "orders.create: procedure principal");
    const orderId = await repository.callCreateOrderComplete(tx, completeParams);
    
    // 7. Criar Itens
    for (const item of validatedItems) {
      const itemParams = mapper.buildItemProcParams(orderId, item);
      await repository.callAddItem(tx, itemParams);
    }

    // 8. Criar Equipamentos
    for (const eq of payload.equipments) {
      const eqParams = mapper.buildEquipmentProcParams(orderId, eq);
      await repository.callAddEquipment(tx, eqParams);
    }

    // 9. Garantir STATUS = 27 (EM ANALISE) - Regra oficial SPRINT 8.9.28
    // O pedido recém-criado deve nascer sempre com status 27, 
    // independente do que a procedure tenha atribuído.
    logger.info({ correlationId, orderId, status: 27 }, "orders.create: forçando status inicial 27");
    await repository.updateStatusToPending(tx, orderId);

    // 10. Reler o pedido para obter N_PEDIDO atribuído pelo ERP
    const created = await repository.fetchCreatedOrder(tx, orderId);

    if (!created) {
      throw new AppError({
        message: "Erro ao confirmar criação do pedido no ERP.",
        statusCode: 500,
        code: "ORDER_CONFIRMATION_FAILED",
        retryable: false
      });
    }

    const result = {
      orderId: Number(created.ID_ORDENS_VENDA),
      orderNumber: Number(created.N_PEDIDO),
      companyId: Number(created.ID_EMPRESA),
      clientId: payload.clientId,
      total: totals.total,
      status: created.STATUS_DESCRICAO ? String(created.STATUS_DESCRICAO).trim() : null,
      deliveryAt: payload.deliveryAt,
      items: validatedItems,
      equipments: payload.equipments
    };

    logger.info(
      { correlationId, orderNumber: result.orderNumber, durationMs: Date.now() - t0 },
      "orders.create: commit"
    );

    return result;
  })).catch((err) => {
    if (err instanceof AppError) throw err;
    
    logger.error({ correlationId, message: err.message }, "orders.create: falha crítica/rollback");
    
    throw new AppError({
      message: "Falha ao criar pedido no ERP.",
      statusCode: 500,
      code: "ORDER_CREATE_FAILED",
      retryable: false
    });
  });
}

/**
 * Camada de idempotência em torno da criação.
 */
async function createOrder({ payload, idempotencyKey, rawBody, correlationId }) {
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new AppError({
      message: "Header Idempotency-Key é obrigatório para criação de pedidos.",
      statusCode: 400,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      retryable: false
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
          message: "Idempotency-Key já utilizada com um payload diferente.",
          statusCode: 409,
          code: "ORDER_CONFLICT",
          retryable: false
        });
      }
      return { replayed: true, order: existing.body.order, status: existing.status };
    }

    const order = await createOrderTransactional({ payload, correlationId });
    const body = { success: true, data: order };
    await store.put(key, buildEntry({ requestHash, status: 201, body }));
    
    return { replayed: false, order, status: 201 };
  });
}

async function getBatchStatus(orderNumbers) {
  const rows = await repository.findStatusByNumbers(orderNumbers);
  const { canEditErpOrder } = require("../../shared/orders/status-rules");
  return rows.map(r => ({
    orderId: Number(r.ID_ORDENS_VENDA),
    orderNumber: Number(r.N_PEDIDO),
    statusId: Number(r.ID_STATUS),
    statusDescription: r.STATUS_DESCRICAO ? String(r.STATUS_DESCRICAO).trim() : null,
    canEdit: canEditErpOrder(r.ID_STATUS)
  }));
}

function newCorrelationId() {
  return crypto.randomUUID();
}

module.exports = {
  createOrder,
  getBatchStatus,
  newCorrelationId,
};
