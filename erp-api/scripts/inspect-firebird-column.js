#!/usr/bin/env node
"use strict";

/**
 * Inspeciona a existência de uma coluna no Firebird via metadata.
 *
 * Uso:
 *   node scripts/inspect-firebird-column.js ORDENS_VENDA CEP
 *
 * Saída:
 *   ORDENS_VENDA.CEP: FOUND
 * ou
 *   ORDENS_VENDA.CEP: NOT_FOUND
 *
 * Conecta DIRETO ao Firebird com as credenciais do .env — NÃO usa HMAC.
 */

require("dotenv").config();

async function main() {
  const [, , tableArg, columnArg] = process.argv;
  if (!tableArg || !columnArg) {
    // eslint-disable-next-line no-console
    console.error("Uso: node scripts/inspect-firebird-column.js <TABELA> <COLUNA>");
    process.exit(2);
  }
  const table = String(tableArg).toUpperCase();
  const column = String(columnArg).toUpperCase();

  const { executeQuery } = require("../src/shared/database/firebird-client");

  const sql = `
    SELECT FIRST 1 TRIM(RDB$FIELD_NAME) AS FIELD
    FROM RDB$RELATION_FIELDS
    WHERE RDB$RELATION_NAME = ?
      AND RDB$FIELD_NAME    = ?
  `;
  try {
    const rows = await executeQuery(sql, [table, column]);
    const found = Array.isArray(rows) && rows.length > 0;
    // eslint-disable-next-line no-console
    console.log(`${table}.${column}: ${found ? "FOUND" : "NOT_FOUND"}`);
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`ERROR: ${err && err.message ? err.message : err}`);
    process.exit(1);
  }
}

main();
