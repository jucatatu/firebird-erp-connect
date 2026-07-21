"use strict";

const firebird = require("../../shared/database/firebird-client");

async function checkErp() {
  return firebird.ping();
}

module.exports = { checkErp };