#!/usr/bin/env node
"use strict";

/**
 * FORENSE — Descobre a origem real do horário de entrega exibido pelo ERP.
 *
 * Contexto: para N_PEDIDO=8431 o ERP mostra 10:44, mas ORDENS_VENDA.
 * DATA_PREV_ENTREGA contém 00:33. Portanto o horário vem de OUTRA tabela/
 * coluna. Este script investiga TODAS as tabelas ligadas ao pedido em
 * busca de qualquer coluna TIME/TIMESTAMP cujo valor seja 10:44 (±1 min),
 * ou colunas cujo nome sugira horário (HORA/AGEND/PROG/ROTA/EXPED/ENTREGA).
 *
 * Uso:
 *   node scripts/hunt-delivery-time.js 8431
 *   node scripts/hunt-delivery-time.js 8431 10 44
 *
 * Somente leitura. Conecta direto no Firebird via .env.
 */

require("dotenv").config();

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

const HINT_RE = /HORA|AGEND|PROG|ROTA|EXPED|ENTREG|SAIDA|CARGA|DESPACHO|PREV|SCHEDUL|DELIV/i;

function pad(n) { return String(n).padStart(2, "0"); }
function fmtTime(v) {
  if (v instanceof Date) return `${pad(v.getHours())}:${pad(v.getMinutes())}`;
  if (typeof v === "string") {
    const m = /(\d{1,2}):(\d{2})/.exec(v);
    if (m) return `${pad(Number(m[1]))}:${pad(Number(m[2]))}`;
  }
  return null;
}

async function main() {
  const nPedido = Number(process.argv[2] || 8431);
  const targetH = process.argv[3] !== undefined ? Number(process.argv[3]) : 10;
  const targetM = process.argv[4] !== undefined ? Number(process.argv[4]) : 44;
  const target = `${pad(targetH)}:${pad(targetM)}`;

  const { executeQuery } = require("../src/shared/database/firebird-client");

  console.log(`\n═══ Caça ao horário ${target} para N_PEDIDO=${nPedido} ═══\n`);

  // 1. Descobrir ID_ORDENS_VENDA e ID_CLIENTE do pedido.
  const base = await executeQuery(
    `SELECT FIRST 1 ID_ORDENS_VENDA, ID_CLIENTE, DATA_PREV_ENTREGA
       FROM ORDENS_VENDA WHERE N_PEDIDO = ?`,
    [nPedido],
  );
  if (!base.length) {
    console.log(`Pedido ${nPedido} não encontrado.`);
    return;
  }
  const idOv = Number(base[0].ID_ORDENS_VENDA);
  const idCli = Number(base[0].ID_CLIENTE);
  console.log(`ID_ORDENS_VENDA=${idOv}  ID_CLIENTE=${idCli}`);
  console.log(`DATA_PREV_ENTREGA bruto: ${base[0].DATA_PREV_ENTREGA}\n`);

  // 2. Listar TODAS as tabelas de usuário que possuam coluna
  //    ID_ORDENS_VENDA ou N_PEDIDO (candidatas a estender o pedido).
  const relatedSql = `
    SELECT DISTINCT TRIM(rf.RDB$RELATION_NAME) AS TABLE_NAME
    FROM RDB$RELATION_FIELDS rf
    JOIN RDB$RELATIONS r ON r.RDB$RELATION_NAME = rf.RDB$RELATION_NAME
    WHERE (r.RDB$SYSTEM_FLAG = 0 OR r.RDB$SYSTEM_FLAG IS NULL)
      AND r.RDB$VIEW_BLR IS NULL
      AND TRIM(rf.RDB$FIELD_NAME) IN ('ID_ORDENS_VENDA', 'N_PEDIDO')
    ORDER BY 1
  `;
  const related = (await executeQuery(relatedSql, [])).map((r) => String(r.TABLE_NAME).trim());
  console.log(`── Tabelas ligadas ao pedido (${related.length}) ──`);
  console.log(`  ${related.join(", ")}\n`);

  // 3. Para cada tabela relacionada, listar colunas TIME/TIMESTAMP ou com nome-hint.
  const hits = [];
  for (const table of related) {
    const colsSql = `
      SELECT TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
             f.RDB$FIELD_TYPE AS FIELD_TYPE
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE rf.RDB$RELATION_NAME = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `;
    const cols = await executeQuery(colsSql, [table]);
    const timeCols = [];
    const fieldNames = [];
    let hasIdOv = false;
    let hasNPed = false;
    for (const c of cols) {
      const name = String(c.FIELD_NAME).trim();
      const type = Number(c.FIELD_TYPE);
      fieldNames.push(name);
      if (name === "ID_ORDENS_VENDA") hasIdOv = true;
      if (name === "N_PEDIDO") hasNPed = true;
      if (type === 13 || type === 35 || HINT_RE.test(name)) {
        timeCols.push({ name, typeName: FIELD_TYPE_NAME[type] || `T${type}` });
      }
    }
    if (!timeCols.length) continue;

    // Localizar registros do pedido.
    const where = hasIdOv
      ? "ID_ORDENS_VENDA = ?"
      : hasNPed
      ? "N_PEDIDO = ?"
      : null;
    if (!where) continue;
    const param = hasIdOv ? idOv : nPedido;

    const selectCols = timeCols.map((c) => c.name).join(", ");
    let rows;
    try {
      rows = await executeQuery(
        `SELECT ${selectCols} FROM ${table} WHERE ${where}`,
        [param],
      );
    } catch (e) {
      console.log(`  ⚠ ${table}: erro ao consultar (${e.message})`);
      continue;
    }
    if (!rows.length) continue;

    console.log(`── ${table} (${rows.length} linha${rows.length > 1 ? "s" : ""}) ──`);
    rows.forEach((row, idx) => {
      for (const col of timeCols) {
        const v = row[col.name];
        const hhmm = fmtTime(v);
        const marker = hhmm === target ? "  ⭐ MATCH" : "";
        const repr =
          v instanceof Date
            ? `Date(local=${pad(v.getHours())}:${pad(v.getMinutes())}, iso=${v.toISOString()})`
            : JSON.stringify(v);
        console.log(`  [${idx}] ${col.name.padEnd(28)} ${col.typeName.padEnd(9)} = ${repr}${marker}`);
        if (hhmm === target) hits.push({ table, column: col.name, value: repr });
      }
    });
    console.log("");
  }

  // 4. Varredura de VIEWS e PROCEDURES que mencionem HORA/PREV/ENTREGA.
  console.log("── Views/procedures/triggers mencionando HORA/PREV/ENTREGA ──");
  const srcSql = `
    SELECT 'VIEW' AS KIND, TRIM(RDB$RELATION_NAME) AS NAME, RDB$VIEW_SOURCE AS SRC
      FROM RDB$RELATIONS
      WHERE RDB$VIEW_SOURCE IS NOT NULL
    UNION ALL
    SELECT 'PROC' AS KIND, TRIM(RDB$PROCEDURE_NAME) AS NAME, RDB$PROCEDURE_SOURCE AS SRC
      FROM RDB$PROCEDURES
      WHERE RDB$PROCEDURE_SOURCE IS NOT NULL
    UNION ALL
    SELECT 'TRIG' AS KIND, TRIM(RDB$TRIGGER_NAME) AS NAME, RDB$TRIGGER_SOURCE AS SRC
      FROM RDB$TRIGGERS
      WHERE RDB$TRIGGER_SOURCE IS NOT NULL
        AND (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
  `;
  const src = await executeQuery(srcSql, []);
  const needle = /HORA|PREV_ENTREGA|AGEND|PROG_ENTREGA|ROTA_ENTREGA|EXPED|DESPACHO/i;
  let matches = 0;
  for (const row of src) {
    let s = row.SRC;
    if (Buffer.isBuffer(s)) s = s.toString("latin1");
    if (typeof s !== "string") continue;
    if (!needle.test(s)) continue;
    matches++;
    if (matches <= 25) {
      const lines = s.split(/\r?\n/).filter((l) => needle.test(l)).slice(0, 3);
      console.log(`  ${row.KIND}  ${String(row.NAME).trim()}`);
      for (const l of lines) console.log(`      · ${l.trim()}`);
    }
  }
  if (matches > 25) console.log(`  … (+${matches - 25} objetos)`);
  if (!matches) console.log("  (nenhum objeto SQL menciona esses termos)");

  console.log("\n═══ RESULTADO ═══");
  if (hits.length) {
    for (const h of hits) console.log(`⭐ ${h.table}.${h.column} = ${h.value}`);
  } else {
    console.log(
      `Nenhuma coluna TIME/TIMESTAMP relacionada ao pedido bateu com ${target}.` +
      `\nRode: node scripts/hunt-delivery-time.js ${nPedido} <HH> <MM>` +
      `\ncom o horário exato exibido no ERP para reforçar a busca.`,
    );
  }
}

main().catch((err) => {
  console.error("ERRO:", err && err.stack ? err.stack : err);
  process.exit(1);
});