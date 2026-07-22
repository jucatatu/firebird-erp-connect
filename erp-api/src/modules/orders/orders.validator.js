"use strict";

const { z } = require("zod");
const { AppError } = require("../../shared/errors/app-error");

// ── Limites do schema Firebird (WIN1252, 1 byte/char) ──────────────────
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

// Tolerância documentada para coerência entre total e soma dos itens.
const TOTAL_TOLERANCE = 0.01;

const finiteNumber = z
  .number({ invalid_type_error: "Deve ser numérico." })
  .refine((n) => Number.isFinite(n), { message: "Valor não pode ser NaN/Infinity." });

const positiveInt = z
  .number({ invalid_type_error: "Deve ser inteiro." })
  .int({ message: "Deve ser inteiro." })
  .positive({ message: "Deve ser inteiro positivo." });

const nonNegative = finiteNumber.refine((n) => n >= 0, {
  message: "Não pode ser negativo.",
});

const positiveNumber = finiteNumber.refine((n) => n > 0, {
  message: "Deve ser maior que zero.",
});

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Data/hora inválida." });

const nullableInt = positiveInt.nullable();

const addressSchema = z.object({
  state: z.string().min(1).max(LIMITS.UF),
  city: z.string().min(1).max(LIMITS.CIDADE),
  district: z.string().min(1).max(LIMITS.BAIRRO),
  street: z.string().min(1).max(LIMITS.RUA),
  number: z.string().min(1).max(LIMITS.NUMERO),
  complement: z.string().max(LIMITS.COMP).nullable().optional(),
  postalCode: z
    .string()
    .transform((v) => (v || "").replace(/\D+/g, "").slice(0, LIMITS.CEP))
    .refine((v) => v.length >= 8, { message: "CEP inválido." }),
});

const itemSchema = z.object({
  productId: positiveInt,
  unitPrice: nonNegative,
  quantity: positiveNumber,
  discount: nonNegative.default(0),
});

const equipmentSchema = z.object({
  equipmentTypeId: positiveInt,
  productId: nullableInt.optional(),
  quantity: positiveInt,
});

const bodySchema = z
  .object({
    customerId: positiveInt,
    companyId: z.union([z.literal(1), z.literal(3), z.null()]).optional(),
    sellerId: positiveInt,
    saleTypeId: positiveInt,
    paymentTermId: positiveInt,
    paymentMethodId: positiveInt,
    delivery: z.boolean(),
    expectedDeliveryAt: isoDateTime,
    deliveryAt: isoDateTime.nullable(),
    retrieveEquipment: z.boolean(),
    returnAt: isoDateTime.nullable(),
    expectedReturnAt: isoDateTime.nullable(),
    total: positiveNumber,
    freight: nonNegative,
    address: addressSchema,
    notes: z.string().max(LIMITS.OBS).nullable().optional(),
    // stockOutput e userId são aceitos por compatibilidade mas IGNORADOS.
    // SAIDA_ESTOQUE é fixado em 0 e ID_USER é a constante interna CAD_USER=2.
    stockOutput: z.boolean().optional(),
    userId: positiveInt.optional(),
    carrierId: nullableInt.optional(),
    carrierVehicleId: nullableInt.optional(),
    commercialDiscountPercent: nonNegative,
    posSessionId: nullableInt.optional(),
    items: z.array(itemSchema).min(1, "items deve ter pelo menos um item."),
    equipment: z.array(equipmentSchema).default([]),
    // NUNCA aceitamos GERA_COBRANCA vindo do frontend — se enviado, é ignorado.
  })
  .strict({ message: "Campos desconhecidos não são permitidos." });

/**
 * Consolida itens duplicados por productId? A procedure ITENS atualiza por
 * produto+ordem, então duplicatas silenciosas sobrescrevem. Por segurança,
 * REJEITAMOS duplicatas — o cliente deve consolidar explicitamente.
 */
function findDuplicate(list, keyFn) {
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const k = keyFn(list[i]);
    if (seen.has(k)) return { index: i, key: k };
    seen.add(k);
  }
  return null;
}

function sumItems(items) {
  return items.reduce(
    (acc, it) => acc + (it.unitPrice * it.quantity - (it.discount || 0)),
    0,
  );
}

function zodIssuesToDetails(issues) {
  return issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Valida o body de POST /orders. Lança AppError VALIDATION_ERROR (400)
 * com `details` público em caso de falha; retorna o payload tipado em sucesso.
 */
function validateCreateOrder(rawBody) {
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError({
      message: "Payload inválido.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
      details: zodIssuesToDetails(parsed.error.issues),
      exposeDetails: true,
    });
  }
  const data = parsed.data;

  const errors = [];

  // companyId final (quando informado) deve ser 1 ou 3 — Zod já garante.
  // Duplicatas em items (por productId).
  const dupItem = findDuplicate(data.items, (it) => it.productId);
  if (dupItem) {
    errors.push({
      field: `items[${dupItem.index}].productId`,
      message: `Produto ${dupItem.key} duplicado. Consolide antes de enviar.`,
    });
  }
  // Duplicatas em equipment (por equipmentTypeId).
  const dupEq = findDuplicate(data.equipment, (e) => e.equipmentTypeId);
  if (dupEq) {
    errors.push({
      field: `equipment[${dupEq.index}].equipmentTypeId`,
      message: `Tipo de equipamento ${dupEq.key} duplicado. Consolide antes de enviar.`,
    });
  }

  // Coerência total vs soma dos itens (tolerância documentada 0.01).
  const soma = sumItems(data.items);
  if (Math.abs(data.total - soma) > TOTAL_TOLERANCE) {
    errors.push({
      field: "total",
      message: `Total (${data.total}) diverge da soma dos itens (${soma.toFixed(2)}). Tolerância: ${TOTAL_TOLERANCE}.`,
    });
  }

  if (errors.length > 0) {
    throw new AppError({
      message: "Payload inválido.",
      statusCode: 400,
      code: "VALIDATION_ERROR",
      retryable: false,
      details: errors,
      exposeDetails: true,
    });
  }

  return data;
}

module.exports = { validateCreateOrder, LIMITS, TOTAL_TOLERANCE, sumItems };