#!/usr/bin/env node
"use strict";
/** Introspecção SOMENTE LEITURA do domínio de PREÇOS. Nenhum endpoint é criado. */
require("dotenv").config();
const { report, runScript, readOnlyQuery } = require("./lib/introspect");

const CANDIDATE_TABLES = [
  "PRECO", "PRECOS", "TABELA_PRECO", "TABELA_PRECOS", "PRECO_PRODUTO",
  "PRECO_CLIENTE", "PRODUTOS", "GRUPO_CLIENTE", "CLIENTES",
];

runScript(async () => {
  console.log("=== TABELAS COM 'PRECO' NO NOME (catálogo)");
  const like = await readOnlyQuery(`
    SELECT TRIM(RDB$RELATION_NAME) AS NAME
    FROM RDB$RELATIONS
    WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE ?
    ORDER BY 1
  `, ["%PRECO%"]);
  for (const r of like) console.log(`  ${r.NAME}`);

  for (const t of CANDIDATE_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await report(t);
  }

  console.log(`
=== PROPOSTA (não implementada nesta sprint)
Cascata sugerida para resolução de preço:
  1. preço específico do CLIENTE (empresa + produto + cliente, vigente)
  2. preço do GRUPO do cliente (empresa + produto + grupo, vigente)
  3. preço PADRÃO do produto (empresa + produto)
Critérios de desempate a confirmar: vigência mais recente, prioridade,
exclusão lógica (DELETED) e flag ativo. Ver docs/INTROSPECTION-REPORT.md.`);
});
