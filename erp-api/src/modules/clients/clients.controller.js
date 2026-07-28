"use strict";

const { asyncHandler } = require("../../shared/utils/async-handler");
const { success } = require("../../shared/http/response");
const { validateSearchQuery, validateClientId } = require("./clients.validator");
const service = require("./clients.service");

const listClients = asyncHandler(async (req, res) => {
  const input = validateSearchQuery(req.query);
  const data = await service.searchClients(input);
  return success(res, data);
});

const getClient = asyncHandler(async (req, res) => {
  const clientId = validateClientId(req.params.clientId);
  const data = await service.getClientById(clientId);
  return success(res, data);
});

module.exports = { listClients, getClient };
