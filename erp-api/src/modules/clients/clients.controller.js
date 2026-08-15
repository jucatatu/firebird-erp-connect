"use strict";

const service = require("./clients.service");
const validator = require("./clients.validator");

async function listClients(req, res, next) {
  try {
    const input = validator.validateSearchQuery(req.query);
    const result = await service.searchClients(input);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getClient(req, res, next) {
  try {
    const clientId = validator.validateClientId(req.params.clientId);
    const result = await service.getClientById(clientId);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function createClient(req, res, next) {
  try {
    const data = validator.validateCreateClient(req.body);
    const result = await service.createClient(data);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listClients, getClient, createClient };
