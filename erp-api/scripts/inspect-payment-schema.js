const firebird = require('../src/shared/database/firebird-client');
const logger = require('../src/shared/utils/logger');

async function inspectTable(tableName) {
  console.log(`\n--- Inspecting Table: ${tableName} ---`);
  try {
    const columns = await firebird.executeQuery(`
      SELECT 
        R.RDB$FIELD_NAME AS FIELD_NAME,
        CASE F.RDB$FIELD_TYPE
          WHEN 7 THEN 'SMALLINT'
          WHEN 8 THEN 'INTEGER'
          WHEN 10 THEN 'FLOAT'
          WHEN 12 THEN 'DATE'
          WHEN 13 THEN 'TIME'
          WHEN 14 THEN 'CHAR'
          WHEN 16 THEN 'BIGINT'
          WHEN 27 THEN 'DOUBLE'
          WHEN 35 THEN 'TIMESTAMP'
          WHEN 37 THEN 'VARCHAR'
          WHEN 261 THEN 'BLOB'
          ELSE 'UNKNOWN'
        END AS FIELD_TYPE
      FROM RDB$RELATION_FIELDS R
      JOIN RDB$FIELDS F ON R.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      WHERE R.RDB$RELATION_NAME = ?
      ORDER BY R.RDB$FIELD_POSITION
    `, [tableName.toUpperCase()]);
    
    if (columns.length === 0) {
      console.log(`Table ${tableName} NOT FOUND.`);
      return;
    }
    
    columns.forEach(col => {
      console.log(`${col.FIELD_NAME.trim().padEnd(25)} | ${col.FIELD_TYPE}`);
    });

    const sample = await firebird.executeQuery(`SELECT FIRST 3 * FROM ${tableName}`);
    console.log('Sample data:', JSON.stringify(sample, null, 2));

  } catch (err) {
    console.error(`Error inspecting ${tableName}:`, err.message);
  }
}

async function run() {
  await inspectTable('FPGTO');
  await inspectTable('FORMA_PAGAMENTO');
  await inspectTable('TIPO_VENDA');
  await inspectTable('CONDICAO_PAGAMENTO');
  process.exit(0);
}

run();
