#!/usr/bin/env node
"use strict";

/**
 * Descobre onde o Firebird guarda o horário de entrega dos pedidos.
 *
 * O que faz:
 *   1. Lista todas as colunas de ORDENS_VENDA cujo tipo é TIME/TIMESTAMP
 *      ou cujo nome contém HORA / ENTREGA (candidatas naturais).
 *   2. Para um N_PEDIDO informado (padrão 8434), imprime o valor bruto
 *      dessas colunas + `DATA_PREV_ENTREGA` como TIMESTAMP.
 *
 * Uso:
 *   node scripts/inspect-order-time.js            # usa N_PEDIDO=8434
 *   node scripts/inspect-order-time.js 8434
 *
 * Conecta DIRETO ao Firebird via .env — NÃO usa HMAC. Somente leitura.
 */

require("dotenv").config();

// Mapa parcial dos tipos internos do Firebird relevantes aqui.
// Ref.: RDB$FIELDS.RDB$FIELD_TYPE
const FIELD_TYPE_NAME = {
  7: "SMALLINT",
  8: "INTEGER",
  10: "FLOAT",
  12: "DATE",
  13: "TIME",
  14: "CHAR",
  16: "BIGINT",
  27: "DOUBLE",
  35: "TIMESTAMP",
  37: "VARCHAR",
  261: "BLOB",
};

async function main() {
  const nPedido = Number(process.argv[2] || 8434);
  const { executeQuery } = require("../src/shared/database/firebird-client");

  const columnsSql = `
    SELECT TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
           f.RDB$FIELD_TYPE       AS FIELD_TYPE,
           f.RDB$FIELD_SUB_TYPE   AS FIELD_SUB_TYPE
    FROM RDB$RELATION_FIELDS rf
    JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
    WHERE rf.RDB$RELATION_NAME = 'ORDENS_VENDA'
    ORDER BY rf.RDB$FIELD_POSITION
  `;

  const cols = await executeQuery(columnsSql, []);
  const candidates = [];
  const allTimestampish = [];
  for (const c of cols) {
    const name = String(c.FIELD_NAME || c.field_name || "").trim();
    const type = Number(c.FIELD_TYPE ?? c.field_type);
    const typeName = FIELD_TYPE_NAME[type] || `TYPE_${type}`;
    if (type === 12 || type === 13 || type === 35) {
      allTimestampish.push({ name, typeName });
    }
    if (/HORA|ENTREGA/i.test(name) || type === 13 || type === 35) {
      candidates.push({ name, typeName });
    }
  }

  console.log("── ORDENS_VENDA · colunas de data/hora ──────────────────────");
  for (const c of allTimestampish) {
    console.log(`  ${c.name.padEnd(30)} ${c.typeName}`);
  }

  console.log("\n── ORDENS_VENDA · candidatas a horário de entrega ───────────");
  const uniq = new Map();
  for (const c of candidates) uniq.set(c.name, c);
  for (const c of uniq.values()) {
    console.log(`  ${c.name.padEnd(30)} ${c.typeName}`);
  }

  const timeishNames = Array.from(uniq.values())
    .filter((c) => c.typeName === "TIME" || c.typeName === "TIMESTAMP" || /HORA/i.test(c.name))
    .map((c) => c.name);
  const includeDataPrev = !timeishNames.includes("DATA_PREV_ENTREGA");
  const selectCols = [
    "N_PEDIDO",
    "ID_ORDENS_VENDA",
    includeDataPrev ? "DATA_PREV_ENTREGA" : null,
    ...timeishNames,
  ].filter(Boolean);

  const rowSql = `
    SELECT FIRST 1 ${selectCols.join(", ")}
    FROM ORDENS_VENDA
    WHERE N_PEDIDO = ?
  `;
  console.log(`\n── Pedido N_PEDIDO=${nPedido} — valores brutos ──────────────`);
  console.log(`SQL: ${rowSql.trim().replace(/\s+/g, " ")}`);
  const rows = await executeQuery(rowSql, [nPedido]);
  if (!rows || rows.length === 0) {
    console.log(`  (nenhuma linha encontrada para N_PEDIDO=${nPedido})`);
    return;
  }
  const row = rows[0];
  for (const col of selectCols) {
    const v = row[col] ?? row[col.toUpperCase()] ?? row[col.toLowerCase()];
    let repr;
    if (v instanceof Date) {
      const iso = v.toISOString();
      const local = `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
      repr = `Date{ iso=${iso}, localHH:mm=${local} }`;
    } else if (v === null || v === undefined) {
      repr = String(v);
    } else {
      repr = `${typeof v} ${JSON.stringify(v)}`;
    }
    console.log(`  ${col.padEnd(30)} = ${repr}`);
  }
}

main().catch((err) => {
  console.error("ERRO:", err && err.message ? err.message : err);
  process.exit(1);
});