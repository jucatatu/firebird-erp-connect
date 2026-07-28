"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateListQuery } = require("./equipment-types.validator");
const service = require("./equipment-types.service");

const listEquipmentTypes = asyncHandler(async (req, res) => {
  const input = validateListQuery(req.query);
  const data = await service.listEquipmentTypes(input);
  return success(res, data);
});

module.exports = { listEquipmentTypes };