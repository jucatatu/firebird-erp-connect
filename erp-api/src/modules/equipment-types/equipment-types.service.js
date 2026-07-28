"use strict";

const repository = require("./equipment-types.repository");
const mapper = require("./equipment-types.mapper");
const { AppError } = require("../../shared/errors/app-error");
const { logger } = require("../../config/logger");
const { buildQPatterns } = require("../../shared/search/like-pattern");

function queryFailed(err) {
  logger.error(
    { code: err && err.code },
    "falha ao consultar tipos de equipamento no ERP",
  );
  if (err && err.name === "AppError") return err;
  return new AppError({
    message: "Não foi possível consultar tipos de equipamento no ERP.",
    statusCode: 500,
    code: "EQUIPMENT_TYPE_QUERY_FAILED",
    retryable: true,
  });
}

async function listEquipmentTypes(input) {
  try {
    const { rows, schema } = await repository.listEquipmentTypes({
      qPatterns: input.q ? buildQPatterns(input.q) : null,
      limit: input.limit,
    });
    let types = rows.map((row) => mapper.mapEquipmentType(row, schema));
    if (input.active !== null && schema.type.active) {
      types = types.filter((t) => t.active === input.active);
    }
    return {
      count: types.length,
      scanned: rows.length,
      limit: input.limit,
      // Catálogo pequeno: sem paginação. `truncated` avisa se bateu no teto.
      truncated: rows.length === input.limit,
      equipmentTypes: types,
    };
  } catch (err) {
    throw queryFailed(err);
  }
}

module.exports = { listEquipmentTypes };