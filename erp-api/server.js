"use strict";

require("dotenv").config();

const { env } = require("./src/config/env");
const { logger } = require("./src/config/logger");
const { createApp } = require("./src/app");

function start() {
  const app = createApp();

  if (env.FIREBIRD_USER && env.FIREBIRD_USER.toLowerCase() === "sysdba") {
    logger.warn(
      "AVISO DE SEGURANÇA: FIREBIRD_USER configurado como SYSDBA. " +
        "Recomenda-se criar um usuário Firebird dedicado com permissões mínimas.",
    );
  }
  if (env.NODE_ENV !== "production" && env.DEV_BYPASS_AUTH) {
    logger.warn(
      "AVISO DE SEGURANÇA: DEV_BYPASS_AUTH está ATIVO (apenas localhost, apenas dev).",
    );
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, version: require("./package.json").version },
      "ERP API iniciada",
    );
  });

  const shutdown = (signal) => {
    logger.info({ signal }, "Encerrando servidor...");
    server.close(() => {
      logger.info("Servidor encerrado.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    process.exit(1);
  });
}

start();