"use strict";

const { logger } = require("../config/logger");

function requestLoggerMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: req.ip,
      },
      "request",
    );
  });

  next();
}

module.exports = { requestLoggerMiddleware };