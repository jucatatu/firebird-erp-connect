"use strict";

const repository = require("./customer-groups.repository");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");

async function listGroups() {
  try {
    const rows = await repository.findAll();
    return {
      groups: rows.map(r => ({
        id: r.ID_GRUPO_CLIENTE,
        description: r.DESCRICAO
      }))
    };
  } catch (err) {
    logger.error({ err }, "Erro ao listar grupos de clientes");
    throw new AppError({
      message: "Erro ao listar grupos de clientes no ERP.",
      statusCode: 500,
      code: "CUSTOMER_GROUP_LIST_FAILED"
    });
  }
}

module.exports = { listGroups };
