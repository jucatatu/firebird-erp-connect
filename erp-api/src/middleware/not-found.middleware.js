"use strict";

function notFoundMiddleware(_req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Recurso não encontrado.",
      retryable: false,
    },
  });
}

module.exports = { notFoundMiddleware };