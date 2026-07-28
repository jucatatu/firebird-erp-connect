#!/usr/bin/env node
"use strict";
/**
 * Diagnóstico SOMENTE LEITURA da busca textual (acentos / collation).
 * Comprova empiricamente se o Firebird desta instalação resolve
 * José/Jose, São/Sao, João/Joao sem folding, e se o padrão com coringa
 * usado pelo módulo de clientes funciona.
 * Não imprime nomes de clientes — apenas contagens.
 */
require("dotenv").config();
const { readOnlyQuery, runScript } = require("./lib/introspect");
const { buildQPatterns } = require("../src/modules/clients/clients.mapper");

const TERMS = ["JOSE", "JOSÉ", "SAO", "SÃO", "JOAO", "JOÃO"];

runScript(async () => {
  const charset = await readOnlyQuery(`
    SELECT TRIM(cs.RDB$CHARACTER_SET_NAME) AS CHARSET,
           TRIM(co.RDB$COLLATION_NAME)     AS COLLATION
    FROM RDB$DATABASE d
    JOIN RDB$CHARACTER_SETS cs ON cs.RDB$CHARACTER_SET_NAME = d.RDB$CHARACTER_SET_NAME
    JOIN RDB$COLLATIONS co ON co.RDB$CHARACTER_SET_ID = cs.RDB$CHARACTER_SET_ID
    ROWS 5
  `);
  console.log("=== CHARSET / COLLATIONS DO BANCO");
  for (const r of charset) console.log(`  ${r.CHARSET} / ${r.COLLATION}`);

  console.log("\n=== CONTAGENS POR TERMO (apenas números, sem dados pessoais)");
  for (const term of TERMS) {
    const patterns = buildQPatterns(term);
    for (const p of patterns) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await readOnlyQuery(
        "SELECT COUNT(*) AS TOTAL FROM PESSOAS WHERE UPPER(NOME) LIKE ?",
        [p],
      );
      console.log(`  termo=${term.padEnd(6)} padrão=${p.padEnd(14)} total=${rows[0].TOTAL}`);
    }
  }
  console.log(`
Leitura: se o total do padrão exato para "JOSE" for ~0 e o do padrão com
coringa for > 0, a collation NÃO é accent-insensitive e o folding aplicado
pelo módulo de clientes é necessário.`);
});
