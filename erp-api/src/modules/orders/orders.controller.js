"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { validateCreateOrder } = require("./orders.validator");
const service = require("./orders.service");

const createOrder = asyncHandler(async (req, res) => {
  const idempotencyKey = req.header("idempotency-key");
  const correlationId = req.requestId || service.newCorrelationId();

  const payload = validateCreateOrder(req.body);
  // rawBody usado para hash: representa o payload validado normalizado.
  const rawBody = JSON.stringify(payload);

  const { order, status, replayed } = await service.createOrder({
    payload,
    idempotencyKey,
    rawBody,
    correlationId,
  });

  res.setHeader("X-Correlation-Id", correlationId);
  if (replayed) res.setHeader("Idempotent-Replay", "true");
  return res.status(status).json({ success: true, order });
});

module.exports = { createOrder };