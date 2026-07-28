#!/usr/bin/env node
"use strict";
/** Introspecção SOMENTE LEITURA de FORMAS/CONDIÇÕES de pagamento. */
require("dotenv").config();
const { report, runScript, readOnlyQuery } = require("./lib/introspect");

const CANDIDATE_TABLES = [
  "FORMA_PAGAMENTO", "FPGTO", "CONDICAO_PAGAMENTO", "PRAZO", "PRAZOS",
  "TIPO_COBRANCA", "CLIENTES",
];

runScript(async () => {
  console.log("=== TABELAS COM 'PAG'/'PGTO'/'PRAZO'/'COBRAN' NO NOME");
  for (const pattern of ["%PAG%", "%PGTO%", "%PRAZO%", "%COBRAN%"]) {
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
  console.log(`
=== PENDÊNCIAS
- diferença semântica entre FORMA_PAGAMENTO e FPGTO;
- qual coluna de CLIENTES guarda a forma padrão e qual guarda o prazo;
- regra específica de boleto.
Nenhum endpoint de pagamento foi criado nesta sprint.`);
});
