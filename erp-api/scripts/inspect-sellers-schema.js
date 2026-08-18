"use strict";

const firebird = require("../shared/database/firebird-client");

/**
 * Script de inspeção de vendedores.
 * Tenta identificar a tabela de vendedores no Firebird através de metadados.
 */
async function inspectSellers() {
  console.log("--- INSPEÇÃO DE VENDEDORES INICIADA ---");
  
  try {
    // 1. Buscar tabelas que contenham colunas como 'ID_VENDEDOR', 'NOME_VENDEDOR', etc.
    const sqlCols = `
      SELECT TRIM(RDB$RELATION_NAME) AS TABLE_NAME, TRIM(RDB$FIELD_NAME) AS FIELD_NAME
      FROM RDB$RELATION_FIELDS
      WHERE RDB$FIELD_NAME LIKE '%VENDEDOR%' 
         OR RDB$FIELD_NAME LIKE '%VEND%'
         OR RDB$RELATION_NAME LIKE '%VENDEDOR%'
         OR RDB$RELATION_NAME LIKE '%FUNCIONARIO%'
    `;
    const candidates = await firebird.executeQuery(sqlCols);
    console.log("Candidatos encontrados (Tabelas/Campos):", candidates);

    // 2. Verificar tabelas óbvias
    const commonTables = ['VENDEDORES', 'FUNCIONARIOS', 'USUARIOS', 'CONTATO'];
    for (const table of commonTables) {
       try {
         const count = await firebird.executeQuery(`SELECT COUNT(*) as TOTAL FROM ${table}`);
         console.log(`Tabela ${table} existe. Linhas:`, count[0].TOTAL || count[0].total);
         
         const sample = await firebird.executeQuery(`SELECT FIRST 3 * FROM ${table}`);
         console.log(`Amostra ${table}:`, sample);
       } catch (e) {
         console.log(`Tabela ${table} não acessível/existente.`);
       }
    }

    console.log("--- FIM DA INSPEÇÃO ---");
  } catch (err) {
    console.error("Erro na inspeção:", err);
  }
}

if (require.main === module) {
  inspectSellers();
}

module.exports = { inspectSellers };
