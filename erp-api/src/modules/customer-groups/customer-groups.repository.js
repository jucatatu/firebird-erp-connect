"use strict";

const firebird = require("../../shared/database/firebird-client");

async function findAll() {
  const sql = `
    SELECT
      ID_GRUPO_CLIENTE,
      DESCRICAO
    FROM GRUPO_CLIENTE
    WHERE (DELETED IS NULL OR DELETED = 0)
    ORDER BY DESCRICAO
  `;
  return await firebird.executeQuery(sql, []);
}

module.exports = { findAll };
