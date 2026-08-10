"use strict";

const firebird = require("./firebird-client");

async function main() {
  console.log("--- Procedures Discovery ---");
  const procs = await firebird.executeQuery(`
    SELECT TRIM(RDB$PROCEDURE_NAME) AS NAME
    FROM RDB$PROCEDURES
    WHERE RDB$PROCEDURE_NAME LIKE '%ORDEM%' 
       OR RDB$PROCEDURE_NAME LIKE '%VENDA%'
       OR RDB$PROCEDURE_NAME LIKE '%ITEM%'
       OR RDB$PROCEDURE_NAME LIKE '%EQUIP%'
  `);
  console.log("Found Procedures:", procs.map(p => p.NAME).join(", "));

  console.log("\n--- Tables Discovery ---");
  const tables = await firebird.executeQuery(`
    SELECT TRIM(RDB$RELATION_NAME) AS NAME
    FROM RDB$RELATIONS
    WHERE RDB$RELATION_NAME IN ('ORDENS_VENDA', 'ITENS_ORDENS_VENDA', 'EQUIP_ORDENS_VENDA')
  `);
  console.log("Found Tables:", tables.map(t => t.NAME).join(", "));
}

main().catch(console.error);
