"use strict";

const { z } = require("zod");
const { AppError } = require("../../shared/errors/app-error");

/**
 * Limites do schema Firebird (WIN1252).
 * Truncamos no mapper para evitar falha do banco, mas validamos aqui para
 * dar feedback precoce ao usuário.
 */
const LIMITS = Object.freeze({
  UF: 3,
  CIDADE: 60,
  BAIRRO: 60,
  RUA: 80,
  NUMERO: 15,
  COMP: 60,
  CEP: 8,
  OBS: 500,
});

const finiteNumber = z
  .number({ invalid_type_error: "Deve ser numérico." })
  .refine((n) => Number.isFinite(n), { message: "Valor não pode ser NaN/Infinity." });

const positiveInt = z
  .number({ invalid_type_error: "Deve ser inteiro." })
  .int({ message: "Deve ser inteiro." })
  .positive({ message: "Deve ser inteiro positivo." });

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Data/hora inválida." });

const itemSchema = z
  .object({
    productId: positiveInt,
    quantity: finiteNumber.positive({ message: "Quantidade deve ser maior que zero." }),
  })
  .strict();

const equipmentSchema = z
  .object({
    equipmentTypeId: positiveInt,
    quantity: positiveInt,
  })
  .strict();

const bodySchema = z
  .object({
    companyId: z.union([z.literal(1), z.literal(3)]),
    clientId: positiveInt,
    sellerId: positiveInt,
    saleTypeId: positiveInt,
    paymentTermId: positiveInt,
    paymentMethodId: positiveInt,
    deliver: z.boolean(),
    deliveryAt: isoDateTime,
    returnEquipment: z.boolean(),
    returnAt: isoDateTime.nullable().optional().default(null),
    freightValue: finiteNumber.min(0).default(0),
    notes: z.string().max(LIMITS.OBS).nullable().optional().default(null),
    items: z.array(itemSchema).min(1, "O pedido deve ter pelo menos 1 item."),
    equipments: z.array(equipmentSchema).default([]),
    // operationId/clientRequestId para idempotência (opcional no payload, 
    // preferimos o header Idempotency-Key já implementado).
  })
  .strict({ message: "Campos desconhecidos não são permitidos no payload." });

function zodIssuesToDetails(issues) {
  return issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Valida o payload do pedido.
 * Lança AppError VALIDATION_ERROR (400) com detalhes públicos em caso de falha.
 */
function validateCreateOrder(rawBody) {
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError({
      message: "Payload do pedido inválido.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
      details: zodIssuesToDetails(parsed.error.issues),
      exposeDetails: true,
    });
  }

  const data = parsed.data;

  // Verificar duplicatas de produtos
  const productIds = data.items.map((it) => it.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError({
      message: "Existem produtos duplicados nos itens.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
      details: [{ field: "items", message: "Produtos duplicados não permitidos." }],
      exposeDetails: true,
    });
  }

  return data;
}

module.exports = { validateCreateOrder, LIMITS };
