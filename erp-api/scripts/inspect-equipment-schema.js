#!/usr/bin/env node
"use strict";
/**
 * Introspecção SOMENTE LEITURA de EQUIPAMENTOS.
 * Objetivo: descobrir se existe categoria ESTRUTURADA capaz de distinguir
 * chopeira / cilindro / barril retornável / acessório — hoje o frontend usa
 * heurística por regex na descrição, o que NÃO deve ser conclusão final.
 */
require("dotenv").config();
const { report, runScript, readOnlyQuery, tableExists } = require("./lib/introspect");

const CANDIDATE_TABLES = [
  "TIPO_EQUIPAMENTO", "EQUIPAMENTOS", "EQUIP_ORDENS_VENDA", "GRUPO_EQUIPAMENTO",
];

runScript(async () => {
  for (const t of CANDIDATE_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await report(t);
  }
  if (await tableExists("TIPO_EQUIPAMENTO")) {
    console.log("\n=== DESCRIÇÕES DISTINTAS DE TIPO_EQUIPAMENTO (dado de catálogo, não pessoal)");
    const rows = await readOnlyQuery(`
      SELECT TRIM(DESCRICAO) AS DESCRICAO
      FROM TIPO_EQUIPAMENTO
      ORDER BY 1
      ROWS 200
    `);
    for (const r of rows) console.log(`  ${r.DESCRICAO}`);
    console.log(`
Se não houver coluna de categoria/flag de retorno obrigatória, documentar a
ausência e propor tabela de mapeamento própria (fora do Firebird) na
próxima sprint. Regex sobre descrição é heurística temporária.`);
  }
});
