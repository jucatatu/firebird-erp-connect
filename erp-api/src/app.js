"use strict";

const express = require("express");
const helmet = require("helmet");

const { env } = require("./config/env");
const { corsMiddleware } = require("./middleware/cors.middleware");
const { requestIdMiddleware } = require("./middleware/request-id.middleware");
const { requestLoggerMiddleware } = require("./middleware/request-logger.middleware");
const { globalRateLimit } = require("./middleware/rate-limit.middleware");
const { notFoundMiddleware } = require("./middleware/not-found.middleware");
const { errorMiddleware } = require("./middleware/error.middleware");

const healthRoutes = require("./modules/health/health.routes");
const operationsRoutes = require("./modules/operations/operations.routes");
const ordersRoutes = require("./modules/orders/orders.routes");
const mapRoutes = require("./modules/map/map.routes");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Só confia em proxies loopback. NUNCA confie cegamente em x-forwarded-for:
  // isso permitiria bypass remoto do auth via header forjado.
  // Se um proxy reverso real for adicionado, ajustar aqui conforme o proxy.
  app.set("trust proxy", "loopback");

  app.use(helmet());
  app.use(corsMiddleware());
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(globalRateLimit);

  // Handler para JSON inválido
  app.use((err, _req, res, next) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Corpo da requisição inválido.",
          retryable: false,
        },
      });
    }
    return next(err);
  });

  // Rotas versionadas
  const v1 = express.Router();
  v1.use("/health", healthRoutes);
  v1.use("/operations", operationsRoutes);
  v1.use("/orders", ordersRoutes);
  v1.use("/map", mapRoutes);
  app.use("/api/v1", v1);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };