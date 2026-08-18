"use strict";

const firebird = require("../src/shared/database/firebird-client");

/**
 * Script de inspeção de vendedores corrigido.
 * Meta: Descobrir onde ID_VENDEDOR é definido via metadados.
 */
async function inspectSellers() {
  console.log("--- INSPEÇÃO DE METADADOS DE VENDEDORES ---");
  
  try {
    // 1. Localizar tabelas que possuem ID_VENDEDOR
    const sqlTables = `
      SELECT DISTINCT TRIM(RDB$RELATION_NAME) AS TABLE_NAME
      FROM RDB$RELATION_FIELDS
      WHERE RDB$FIELD_NAME = 'ID_VENDEDOR'
    `;
    const tablesWithField = await firebird.executeQuery(sqlTables);
    console.log("Tabelas com coluna ID_VENDEDOR:", tablesWithField.map(t => t.TABLE_NAME));

    // 2. Investigar Relações (Foreign Keys) para ID_VENDEDOR
    const sqlFKs = `
      SELECT 
        TRIM(rc.RDB$RELATION_NAME) as TABLE_NAME,
        TRIM(rc.RDB$CONSTRAINT_NAME) as CONSTRAINT_NAME,
        TRIM(rc.RDB$CONSTRAINT_TYPE) as CONSTRAINT_TYPE,
        TRIM(ref.RDB$CONST_NAME_UQ) as REF_CONSTRAINT
      FROM RDB$RELATION_CONSTRAINTS rc
      JOIN RDB$REF_CONSTRAINTS ref ON rc.RDB$CONSTRAINT_NAME = ref.RDB$CONSTRAINT_NAME
      JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
      WHERE iseg.RDB$FIELD_NAME = 'ID_VENDEDOR'
    `;
    const fks = await firebird.executeQuery(sqlFKs);
    console.log("Relacionamentos FK envolvendo ID_VENDEDOR:", fks);

    // 3. Investigar se existe uma tabela que tenha ID_VENDEDOR como Primary Key ou Unique
    const sqlPKs = `
      SELECT TRIM(rc.RDB$RELATION_NAME) as TABLE_NAME
      FROM RDB$RELATION_CONSTRAINTS rc
      JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
      WHERE iseg.RDB$FIELD_NAME = 'ID_VENDEDOR'
        AND rc.RDB$CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')
    `;
    const pks = await firebird.executeQuery(sqlPKs);
    console.log("Tabelas onde ID_VENDEDOR é PK ou UNIQUE:", pks.map(t => t.TABLE_NAME));

    console.log("--- FIM DA INSPEÇÃO ---");
  } catch (err) {
    console.error("Erro na inspeção técnica:", err);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  inspectSellers();
}

module.exports = { inspectSellers };

