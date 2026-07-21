"use strict";

const { logger } = require("../config/logger");
const { AppError } = require("../shared/errors/app-error");

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, _next) {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    logger.warn(
      { requestId, code: err.code, statusCode: err.statusCode, details: err.details },
      err.message,
    );
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        requestId,
      },
    });
  }

  // Erro desconhecido: log completo interno, resposta genérica
  logger.error({ requestId, err: { message: err && err.message, stack: err && err.stack } }, "unhandled error");

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Erro interno do servidor.",
      retryable: false,
      requestId,
    },
  });
}

module.exports = { errorMiddleware };