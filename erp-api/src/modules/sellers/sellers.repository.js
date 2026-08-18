"use strict";

const firebird = require("../../shared/database/firebird-client");
const { toErpSeller } = require("./sellers.mapper");

async function searchSellers(query = "", limit = 50) {
  const sql = "SELECT FIRST ? ID_VENDEDOR, NOME FROM VENDEDORES WHERE NOME LIKE ? ORDER BY NOME";
  const params = [limit, "%" + query + "%"];
  
  try {
    const rows = await firebird.executeQuery(sql, params);
    return rows.map(toErpSeller);
  } catch (err) {
    const sqlFallback = "SELECT FIRST ? ID as ID_VENDEDOR, NOME FROM FUNCIONARIOS WHERE NOME LIKE ? ORDER BY NOME";
    try {
      const fallbackRows = await firebird.executeQuery(sqlFallback, params);
      return fallbackRows.map(toErpSeller);
    } catch (err2) {
      return [];
    }
  }
}

module.exports = { searchSellers };
