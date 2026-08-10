"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { validateCreateOrder, validateUpdateOrder } = require("./orders.validator");
const service = require("./orders.service");

const getBatchStatus = asyncHandler(async (req, res) => {
  const { orderIds } = req.query;
  if (!orderIds) return res.json({ success: true, data: [] });
  const ids = String(orderIds).split(",").map(Number).filter(Boolean);
  const statuses = await service.getBatchStatus(ids);
  return res.json({ success: true, data: statuses });
});

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
  return res.status(status).json({ success: true, data: order });
});

const getOrder = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const order = await service.getOrderDetail(Number(orderNumber));
  return res.json({ success: true, data: order });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const correlationId = req.requestId || service.newCorrelationId();

  // O body deve vir com os campos de CreateOrderInput + possivelmente orderId/orderNumber
  // O validador validateUpdateOrder espera orderId, vamos ajustar para pegar da URL se necessário
  const payload = validateUpdateOrder({ ...req.body, orderNumber: Number(orderNumber) });

  const order = await service.updateOrder({
    orderNumber: Number(orderNumber),
    payload,
    correlationId,
  });

  res.setHeader("X-Correlation-Id", correlationId);
  return res.json({ success: true, data: order });
});

module.exports = { createOrder, getBatchStatus, getOrder, updateOrder };