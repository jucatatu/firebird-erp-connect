"use strict";

const service = require("./customer-groups.service");

async function listGroups(req, res, next) {
  try {
    const result = await service.listGroups();
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listGroups };
