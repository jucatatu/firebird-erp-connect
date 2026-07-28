#!/usr/bin/env node
"use strict";
/** Introspecção SOMENTE LEITURA de PRODUTOS. Nenhuma busca é implementada. */
require("dotenv").config();
const { report, runScript, readOnlyQuery } = require("./lib/introspect");

const CANDIDATE_TABLES = [
  "PRODUTOS", "GRUPO_PRODUTO", "UNIDADE", "ESTOQUE", "CATEGORIA_PRODUTO",
];

runScript(async () => {
  console.log("=== TABELAS COM 'PRODUT'/'ESTOQ' NO NOME");
  for (const pattern of ["%PRODUT%", "%ESTOQ%"]) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await readOnlyQuery(`
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE ?
      ORDER BY 1
    `, [pattern]);
    for (const r of rows) console.log(`  ${r.NAME}`);
  }
  for (const t of CANDIDATE_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await report(t);
  }
});
