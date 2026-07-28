#!/usr/bin/env node
"use strict";

/**
 * SPRINT 6 — Descoberta da criação de pedidos (SOMENTE LEITURA).
 *
 * Este script NÃO escreve nada no Firebird. Ele apenas consulta o catálogo
 * (RDB$*) e imprime tudo que é necessário para documentar como o ERP cria
 * um pedido:
 *
 *   1. Estrutura de ORDENS_VENDA e ITENS_ORDENS_VENDA (colunas, tipos,
 *      NOT NULL, DEFAULT, PK/FK/UNIQUE).
 *   2. Generators/sequences candidatos.
 *   3. Triggers das duas tabelas, com tipo (antes/depois de gravação) e
 *      código-fonte completo.
 *   4. Procedures relacionadas a ordem/item/equipamento, com parâmetros
 *      de entrada/saída e código-fonte.
 *   5. Tabelas dependentes (quem referencia ORDENS_VENDA).
 *
 * Uso, no servidor Windows que enxerga o Firebird:
 *   node scripts/inspect-order-creation.js            # resumo no console
 *   node scripts/inspect-order-creation.js --source   # inclui fonte completa
 *   node scripts/inspect-order-creation.js --source > docs/order-creation-dump.txt
 *
 * O dump NÃO contém dados de clientes/pedidos — apenas metadados.
 */

require("dotenv").config();
const { readOnlyQuery, describeTable, typeName, runScript } = require("./lib/introspect");

const WITH_SOURCE = process.argv.includes("--source");
const TABLES = ["ORDENS_VENDA", "ITENS_ORDENS_VENDA", "EQUIP_ORDENS_VENDA"];

/* --- helpers ---------------------------------------------------------- */

function line(char = "-") {
  console.log(char.repeat(78));
}

async function blobToString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Buffer.isBuffer(v)) return v.toString("latin1");
  if (typeof v === "function") {
    // node-firebird entrega BLOB como função de leitura assíncrona.
    return new Promise((resolve) => {
      try {
        v((err, _name, emitter) => {
          if (err || !emitter) return resolve("");
          const chunks = [];
          emitter.on("data", (c) => chunks.push(c));
          emitter.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
          emitter.on("error", () => resolve(""));
          return undefined;
        });
      } catch (_e) {
        resolve("");
      }
    });
  }
  return String(v);
}

/**
 * Decodifica RDB$TRIGGER_TYPE em texto legível sem usar palavras-chave de
 * escrita no SQL (o guard read-only bloquearia o literal).
 */
function triggerTypeLabel(code) {
  const t = Number(code);
  const simple = {
    1: "ANTES / gravação de linha nova",
    2: "DEPOIS / gravação de linha nova",
    3: "ANTES / alteração de linha",
    4: "DEPOIS / alteração de linha",
    5: "ANTES / remoção de linha",
    6: "DEPOIS / remoção de linha",
  };
  if (simple[t]) return simple[t];
  // Triggers multi-ação (Firebird combina bits em slots de 2 bits).
  const before = (t & 1) === 1 ? "ANTES" : "DEPOIS";
  const actions = [];
  let rest = t + 1;
  for (let slot = 0; slot < 3; slot++) {
    const action = (rest >> (slot * 2 + 1)) & 3;
    if (action === 1) actions.push("gravação");
    if (action === 2) actions.push("alteração");
    if (action === 3) actions.push("remoção");
  }
  if (t >= 8192) return `TRIGGER DE BANCO/DDL (type=${t})`;
  return `${before} / ${actions.join(" + ") || "?"} (type=${t})`;
}

/* --- 1. estrutura ----------------------------------------------------- */

async function reportColumns(table) {
  line("=");
  console.log(`TABELA ${table} — COLUNAS`);
  line("=");
  const cols = await describeTable(table);
  if (!cols.length) {
    console.log("  (tabela não encontrada)");
    return;
  }
  const defaults = await readOnlyQuery(
    `
      SELECT
        TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
        rf.RDB$DEFAULT_SOURCE   AS COL_DEFAULT,
        f.RDB$DEFAULT_SOURCE    AS DOMAIN_DEFAULT
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE rf.RDB$RELATION_NAME = ?
    `,
    [table],
  );
  const defByField = new Map();
  for (const d of defaults) {
    // eslint-disable-next-line no-await-in-loop
    const own = await blobToString(d.COL_DEFAULT);
    // eslint-disable-next-line no-await-in-loop
    const dom = await blobToString(d.DOMAIN_DEFAULT);
    defByField.set(String(d.FIELD_NAME).trim(), (own || dom || "").replace(/\s+/g, " ").trim());
  }
  for (const c of cols) {
    const name = String(c.FIELD_NAME).trim();
    const req = Number(c.NOT_NULL) === 1 ? "OBRIGATÓRIO" : "opcional";
    const def = defByField.get(name);
    console.log(
      `  ${name.padEnd(28)} ${typeName(c).padEnd(20)} ${req.padEnd(12)} ${def ? `default: ${def}` : ""}`,
    );
  }
}

async function reportConstraints(table) {
  const rows = await readOnlyQuery(
    `
      SELECT
        TRIM(rc.RDB$CONSTRAINT_NAME) AS CNAME,
        TRIM(rc.RDB$CONSTRAINT_TYPE) AS CTYPE,
        TRIM(seg.RDB$FIELD_NAME)     AS FIELD_NAME,
        TRIM(COALESCE(i2.RDB$RELATION_NAME, '')) AS REF_TABLE
      FROM RDB$RELATION_CONSTRAINTS rc
      JOIN RDB$INDEX_SEGMENTS seg ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
      LEFT JOIN RDB$REF_CONSTRAINTS ref ON ref.RDB$CONSTRAINT_NAME = rc.RDB$CONSTRAINT_NAME
      LEFT JOIN RDB$INDICES i2 ON i2.RDB$INDEX_NAME = ref.RDB$CONST_NAME_UQ
      WHERE rc.RDB$RELATION_NAME = ?
      ORDER BY rc.RDB$CONSTRAINT_TYPE, rc.RDB$CONSTRAINT_NAME, seg.RDB$FIELD_POSITION
    `,
    [table],
  );
  console.log(`\n-- restrições de ${table}:`);
  for (const r of rows) {
    console.log(
      `   ${String(r.CTYPE).padEnd(12)} ${String(r.FIELD_NAME).padEnd(26)} ${r.REF_TABLE ? `→ ${r.REF_TABLE}` : ""}`,
    );
  }
}

/* --- 2. generators ---------------------------------------------------- */

async function reportGenerators() {
  line("=");
  console.log("GENERATORS / SEQUENCES (candidatos a numeração de pedido)");
  line("=");
  const rows = await readOnlyQuery(`
    SELECT TRIM(RDB$GENERATOR_NAME) AS NAME
    FROM RDB$GENERATORS
    WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
      AND (RDB$GENERATOR_NAME LIKE '%ORDEN%'
        OR RDB$GENERATOR_NAME LIKE '%ORDEM%'
        OR RDB$GENERATOR_NAME LIKE '%PEDIDO%'
        OR RDB$GENERATOR_NAME LIKE '%VENDA%')
    ORDER BY 1
  `);
  for (const r of rows) {
    // eslint-disable-next-line no-await-in-loop
    const cur = await readOnlyQuery(
      `SELECT GEN_ID(${r.NAME}, 0) AS VALOR FROM RDB$DATABASE`,
    ).catch(() => null);
    const valor = cur && cur[0] ? cur[0].VALOR : "?";
    console.log(`  ${String(r.NAME).padEnd(40)} valor atual: ${valor}`);
  }
  if (!rows.length) console.log("  (nenhum generator com nome relacionado)");
}

/* --- 3. triggers ------------------------------------------------------ */

async function reportTriggers(table) {
  line("=");
  console.log(`TRIGGERS DE ${table}`);
  line("=");
  const rows = await readOnlyQuery(
    `
      SELECT
        TRIM(RDB$TRIGGER_NAME)       AS NAME,
        RDB$TRIGGER_TYPE             AS TTYPE,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE,
        RDB$TRIGGER_SEQUENCE         AS SEQ,
        RDB$TRIGGER_SOURCE           AS SRC
      FROM RDB$TRIGGERS
      WHERE RDB$RELATION_NAME = ?
        AND COALESCE(RDB$SYSTEM_FLAG, 0) = 0
      ORDER BY RDB$TRIGGER_TYPE, RDB$TRIGGER_SEQUENCE
    `,
    [table],
  );
  if (!rows.length) {
    console.log("  (nenhuma trigger de usuário)");
    return;
  }
  for (const t of rows) {
    console.log(
      `\n  ${String(t.NAME).padEnd(36)} ${triggerTypeLabel(t.TTYPE)}` +
        ` pos=${t.SEQ} ${Number(t.INACTIVE) === 1 ? "[INATIVA]" : "[ativa]"}`,
    );
    if (WITH_SOURCE) {
      // eslint-disable-next-line no-await-in-loop
      const src = await blobToString(t.SRC);
      console.log(src.split("\n").map((l) => `      | ${l}`).join("\n"));
    }
  }
}

/* --- 4. procedures ---------------------------------------------------- */

async function reportProcedures() {
  line("=");
  console.log("PROCEDURES RELACIONADAS A PEDIDO / ITEM / EQUIPAMENTO");
  line("=");
  const procs = await readOnlyQuery(`
    SELECT TRIM(RDB$PROCEDURE_NAME) AS NAME, RDB$PROCEDURE_SOURCE AS SRC
    FROM RDB$PROCEDURES
    WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
      AND (RDB$PROCEDURE_NAME LIKE '%ORDEN%'
        OR RDB$PROCEDURE_NAME LIKE '%ORDEM%'
        OR RDB$PROCEDURE_NAME LIKE '%PEDIDO%'
        OR RDB$PROCEDURE_NAME LIKE '%ITENS%'
        OR RDB$PROCEDURE_NAME LIKE '%EQUIP%')
    ORDER BY 1
  `);
  for (const p of procs) {
    console.log(`\n  ${p.NAME}`);
    // eslint-disable-next-line no-await-in-loop
    const params = await readOnlyQuery(
      `
        SELECT
          TRIM(pp.RDB$PARAMETER_NAME) AS PNAME,
          pp.RDB$PARAMETER_TYPE       AS PTYPE,
          pp.RDB$PARAMETER_NUMBER     AS PNUM,
          f.RDB$FIELD_TYPE            AS FIELD_TYPE,
          f.RDB$FIELD_SUB_TYPE        AS FIELD_SUB_TYPE,
          f.RDB$FIELD_LENGTH          AS FIELD_LENGTH,
          f.RDB$FIELD_SCALE           AS FIELD_SCALE
        FROM RDB$PROCEDURE_PARAMETERS pp
        JOIN RDB$FIELDS f ON pp.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
        WHERE pp.RDB$PROCEDURE_NAME = ?
        ORDER BY pp.RDB$PARAMETER_TYPE, pp.RDB$PARAMETER_NUMBER
      `,
      [p.NAME],
    );
    for (const pa of params) {
      const dir = Number(pa.PTYPE) === 0 ? "IN " : "OUT";
      console.log(`     ${dir} [${pa.PNUM}] ${String(pa.PNAME).padEnd(26)} ${typeName(pa)}`);
    }
    if (WITH_SOURCE) {
      // eslint-disable-next-line no-await-in-loop
      const src = await blobToString(p.SRC);
      console.log(src.split("\n").map((l) => `      | ${l}`).join("\n"));
    }
  }
  if (!procs.length) console.log("  (nenhuma procedure encontrada com esses nomes)");
}

/* --- 5. dependências -------------------------------------------------- */

async function reportDependents() {
  line("=");
  console.log("TABELAS QUE REFERENCIAM ORDENS_VENDA (dependências de escrita)");
  line("=");
  const rows = await readOnlyQuery(`
    SELECT DISTINCT
      TRIM(rc.RDB$RELATION_NAME) AS ORIGEM,
      TRIM(seg.RDB$FIELD_NAME)   AS CAMPO
    FROM RDB$RELATION_CONSTRAINTS rc
    JOIN RDB$REF_CONSTRAINTS ref ON ref.RDB$CONSTRAINT_NAME = rc.RDB$CONSTRAINT_NAME
    JOIN RDB$INDICES i2          ON i2.RDB$INDEX_NAME = ref.RDB$CONST_NAME_UQ
    JOIN RDB$INDEX_SEGMENTS seg  ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
    WHERE rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND i2.RDB$RELATION_NAME = 'ORDENS_VENDA'
    ORDER BY 1, 2
  `);
  for (const r of rows) console.log(`  ${String(r.ORIGEM).padEnd(34)} .${r.CAMPO}`);
  if (!rows.length) console.log("  (nenhuma FK declarada apontando para ORDENS_VENDA)");
}

/* --- main ------------------------------------------------------------- */

runScript(async () => {
  console.log("SPRINT 6 — DESCOBERTA DA CRIAÇÃO DE PEDIDOS (somente leitura)");
  console.log(WITH_SOURCE ? "modo: com código-fonte\n" : "modo: resumo (use --source para o código)\n");
  for (const t of TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await reportColumns(t);
    // eslint-disable-next-line no-await-in-loop
    await reportConstraints(t);
  }
  await reportGenerators();
  for (const t of TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await reportTriggers(t);
  }
  await reportProcedures();
  await reportDependents();
  console.log("\nFim. Nenhuma escrita foi realizada no Firebird.");
});