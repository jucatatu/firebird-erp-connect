#!/usr/bin/env node
"use strict";

/**
 * SPRINT 6.1 — Descoberta final do fluxo de criação de pedidos (SOMENTE LEITURA).
 *
 * Complementa scripts/inspect-order-creation.js: em vez de um resumo no
 * console, este script gera um RELATÓRIO MARKDOWN COMPLETO com o código-fonte
 * integral de triggers e procedures, resolvendo dependências recursivamente
 * pelo catálogo (RDB$DEPENDENCIES).
 *
 * GARANTIAS:
 *   - Todo SQL passa pelo guard de scripts/lib/introspect.js, que recusa
 *     qualquer comando que não comece com SELECT.
 *   - Nenhuma linha de pedido/cliente é lida ou impressa: apenas catálogo
 *     (RDB$*) e valores de generators.
 *
 * Uso, no servidor Windows que enxerga o Firebird:
 *   node scripts/inspect-order-source.js
 *   node scripts/inspect-order-source.js --out docs/ORDER-CREATION-SOURCE.md
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { readOnlyQuery, describeTable, typeName, runScript } = require("./lib/introspect");

const ROOT_TABLES = ["ORDENS_VENDA", "ITENS_ORDENS_VENDA", "EQUIP_ORDENS_VENDA"];
const ROOT_PROCS = [
  "SP_CAD_ORDEM_VENDA_COMPLETO",
  "SP_CAD_ORDEM_VENDA",
  "SP_CAD_ITENS_ORDENS_VENDA",
  "SP_CAD_EQUIP_ORDENS_VENDA",
];

const outFlagIndex = process.argv.indexOf("--out");
const OUT_FILE = outFlagIndex > -1 ? process.argv[outFlagIndex + 1] : null;

const out = [];
const w = (s = "") => out.push(s);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function blobToString(v) {
  if (v === null || v === undefined) return Promise.resolve("");
  if (typeof v === "string") return Promise.resolve(v);
  if (Buffer.isBuffer(v)) return Promise.resolve(v.toString("latin1"));
  if (typeof v === "function") {
    return new Promise((resolve) => {
      try {
        v((err, _name, emitter) => {
          if (err || !emitter) return resolve("");
          const chunks = [];
          emitter.on("data", (c) => chunks.push(Buffer.from(c)));
          emitter.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
          emitter.on("error", () => resolve(""));
          return undefined;
        });
      } catch (_e) {
        resolve("");
      }
    });
  }
  return Promise.resolve(String(v));
}

/** Decodifica RDB$TRIGGER_TYPE (BEFORE/AFTER + ações). */
function decodeTriggerType(code) {
  const t = Number(code);
  const simple = {
    1: { when: "BEFORE", actions: ["INSERT"] },
    2: { when: "AFTER", actions: ["INSERT"] },
    3: { when: "BEFORE", actions: ["UPDATE"] },
    4: { when: "AFTER", actions: ["UPDATE"] },
    5: { when: "BEFORE", actions: ["DELETE"] },
    6: { when: "AFTER", actions: ["DELETE"] },
  };
  if (simple[t]) return simple[t];
  if (t >= 8192) return { when: "DATABASE/DDL", actions: [`type=${t}`] };
  const when = (t & 1) === 1 ? "BEFORE" : "AFTER";
  const names = { 1: "INSERT", 2: "UPDATE", 3: "DELETE" };
  const actions = [];
  const rest = t + 1;
  for (let slot = 0; slot < 3; slot++) {
    const a = (rest >> (slot * 2 + 1)) & 3;
    if (names[a] && !actions.includes(names[a])) actions.push(names[a]);
  }
  return { when, actions: actions.length ? actions : [`type=${t}`] };
}

/** Heurística de leitura: classifica o que a fonte faz (só para o resumo). */
function summarizeSource(src) {
  const s = String(src || "").toUpperCase();
  const notes = [];
  const has = (re) => re.test(s);
  if (has(/GEN_ID\s*\(/)) notes.push("usa generator (GEN_ID)");
  if (has(/N_PEDIDO/)) notes.push("toca N_PEDIDO");
  if (has(/MAX\s*\(\s*N_PEDIDO/)) notes.push("**calcula N_PEDIDO por MAX()+1** (colide sob concorrência)");
  if (has(/\bESTOQUE\b|SALDO|MOVIMENT/)) notes.push("movimenta estoque/saldo");
  if (has(/COBRANCA|COMANDA|FINANCEIRO|DUPLICATA|PARCELA|CONTAS_RECEBER/)) notes.push("gera financeiro/cobrança");
  if (has(/HISTORIC|AUDIT|LOG_/)) notes.push("grava histórico/auditoria");
  if (has(/EXCEPTION/)) notes.push("lança exceção de validação");
  if (has(/TOTAL|SUBTOTAL|VALOR_TOTAL/)) notes.push("calcula totais");
  if (has(/CURRENT_TIMESTAMP|CURRENT_DATE|'NOW'/)) notes.push("carimba data/hora automaticamente");
  if (has(/ID_STATUS/)) notes.push("atribui status");
  return notes;
}

/** Objetos escritos/lidos por um objeto do catálogo. */
async function dependenciesOf(name, dependentType) {
  const rows = await readOnlyQuery(
    `
      SELECT DISTINCT
        TRIM(RDB$DEPENDED_ON_NAME)  AS TARGET,
        RDB$DEPENDED_ON_TYPE        AS TARGET_TYPE,
        TRIM(COALESCE(RDB$FIELD_NAME, '')) AS FIELD_NAME
      FROM RDB$DEPENDENCIES
      WHERE RDB$DEPENDENT_NAME = ?
        AND RDB$DEPENDENT_TYPE = ?
      ORDER BY 1, 3
    `,
    [name, dependentType],
  );
  const TYPES = { 0: "tabela/view", 1: "view", 2: "trigger", 5: "procedure", 14: "generator", 15: "UDF" };
  const grouped = new Map();
  for (const r of rows) {
    const key = `${TYPES[Number(r.TARGET_TYPE)] || `tipo ${r.TARGET_TYPE}`}|${r.TARGET}`;
    if (!grouped.has(key)) grouped.set(key, []);
    if (r.FIELD_NAME) grouped.get(key).push(r.FIELD_NAME);
  }
  return [...grouped.entries()].map(([key, fields]) => {
    const [kind, target] = key.split("|");
    return { kind, target, fields };
  });
}

/* ------------------------------------------------------------------ */
/* 1. triggers                                                         */
/* ------------------------------------------------------------------ */

const triggerIndex = [];

async function dumpTriggers(table) {
  const rows = await readOnlyQuery(
    `
      SELECT
        TRIM(RDB$TRIGGER_NAME)            AS NAME,
        RDB$TRIGGER_TYPE                  AS TTYPE,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE,
        COALESCE(RDB$TRIGGER_SEQUENCE, 0) AS SEQ,
        RDB$TRIGGER_SOURCE                AS SRC,
        RDB$DESCRIPTION                   AS DESCR
      FROM RDB$TRIGGERS
      WHERE RDB$RELATION_NAME = ?
        AND COALESCE(RDB$SYSTEM_FLAG, 0) = 0
      ORDER BY RDB$TRIGGER_TYPE, RDB$TRIGGER_SEQUENCE, RDB$TRIGGER_NAME
    `,
    [table],
  );

  w(`### Triggers de \`${table}\``);
  w();
  if (!rows.length) {
    w(`Nenhuma trigger de usuário declarada em \`${table}\`.`);
    w();
    return;
  }

  w("| Trigger | Momento | Ação | Posição | Estado |");
  w("| --- | --- | --- | --- | --- |");
  for (const t of rows) {
    const d = decodeTriggerType(t.TTYPE);
    w(
      `| \`${t.NAME}\` | ${d.when} | ${d.actions.join(" + ")} | ${t.SEQ} | ${
        Number(t.INACTIVE) === 1 ? "**INATIVA**" : "ativa"
      } |`,
    );
  }
  w();

  for (const t of rows) {
    const d = decodeTriggerType(t.TTYPE);
    // eslint-disable-next-line no-await-in-loop
    const src = await blobToString(t.SRC);
    // eslint-disable-next-line no-await-in-loop
    const deps = await dependenciesOf(String(t.NAME).trim(), 2);
    const notes = summarizeSource(src);
    triggerIndex.push({ table, name: String(t.NAME).trim(), when: d.when, actions: d.actions, notes, src });

    w(`#### \`${t.NAME}\``);
    w();
    w(
      `- **Tabela:** \`${table}\`\n- **Momento:** ${d.when}\n- **Ação:** ${d.actions.join(
        " + ",
      )}\n- **Posição:** ${t.SEQ}\n- **Estado:** ${Number(t.INACTIVE) === 1 ? "INATIVA" : "ativa"}`,
    );
    w(`- **Comportamento observado na fonte:** ${notes.length ? notes.join("; ") : "sem efeito colateral reconhecido automaticamente — ler a fonte abaixo"}`);
    if (deps.length) {
      w("- **Objetos referenciados:**");
      for (const dep of deps) {
        w(`  - ${dep.kind} \`${dep.target}\`${dep.fields.length ? ` (${dep.fields.join(", ")})` : ""}`);
      }
    } else {
      w("- **Objetos referenciados:** nenhum registrado em `RDB$DEPENDENCIES`");
    }
    w();
    w("```sql");
    w(src.trimEnd() || "-- (fonte vazia no catálogo)");
    w("```");
    w();
  }
}

/* ------------------------------------------------------------------ */
/* 2. procedures (com resolução recursiva de dependências)             */
/* ------------------------------------------------------------------ */

const procIndex = [];

async function listCandidateProcedures() {
  const byName = await readOnlyQuery(`
    SELECT TRIM(RDB$PROCEDURE_NAME) AS NAME
    FROM RDB$PROCEDURES
    WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
      AND (RDB$PROCEDURE_NAME LIKE '%ORDEN%'
        OR RDB$PROCEDURE_NAME LIKE '%ORDEM%'
        OR RDB$PROCEDURE_NAME LIKE '%PEDIDO%'
        OR RDB$PROCEDURE_NAME LIKE '%ITENS%'
        OR RDB$PROCEDURE_NAME LIKE '%EQUIP%')
    ORDER BY 1
  `);
  return new Set([...ROOT_PROCS, ...byName.map((r) => String(r.NAME).trim())]);
}

async function procedureExists(name) {
  const rows = await readOnlyQuery(
    `SELECT FIRST 1 TRIM(RDB$PROCEDURE_NAME) AS NAME FROM RDB$PROCEDURES WHERE RDB$PROCEDURE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

async function procedureParams(name) {
  return readOnlyQuery(
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
    [name],
  );
}

async function procedureSource(name) {
  const rows = await readOnlyQuery(
    `SELECT FIRST 1 RDB$PROCEDURE_SOURCE AS SRC FROM RDB$PROCEDURES WHERE RDB$PROCEDURE_NAME = ?`,
    [name],
  );
  return rows.length ? blobToString(rows[0].SRC) : "";
}

async function dumpProcedures() {
  const queue = [...(await listCandidateProcedures())];
  const seen = new Set();

  while (queue.length) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    // eslint-disable-next-line no-await-in-loop
    if (!(await procedureExists(name))) {
      w(`#### \`${name}\` — **não existe no banco**`);
      w();
      continue;
    }

    /* eslint-disable no-await-in-loop */
    const params = await procedureParams(name);
    const src = await procedureSource(name);
    const deps = await dependenciesOf(name, 5);
    /* eslint-enable no-await-in-loop */

    const inputs = params.filter((p) => Number(p.PTYPE) === 0);
    const outputs = params.filter((p) => Number(p.PTYPE) !== 0);
    const notes = summarizeSource(src);
    procIndex.push({ name, notes, src, deps });

    w(`#### \`${name}\``);
    w();
    w(`- **Comportamento observado na fonte:** ${notes.length ? notes.join("; ") : "nenhum efeito colateral reconhecido automaticamente — ler a fonte"}`);
    w();
    w("**Parâmetros de entrada**");
    w();
    if (inputs.length) {
      w("| # | Nome | Tipo |");
      w("| --- | --- | --- |");
      for (const p of inputs) w(`| ${p.PNUM} | \`${p.PNAME}\` | ${typeName(p)} |`);
    } else {
      w("_(nenhum)_");
    }
    w();
    w("**Parâmetros de saída**");
    w();
    if (outputs.length) {
      w("| # | Nome | Tipo |");
      w("| --- | --- | --- |");
      for (const p of outputs) w(`| ${p.PNUM} | \`${p.PNAME}\` | ${typeName(p)} |`);
    } else {
      w("_(nenhum — procedure não selecionável)_");
    }
    w();
    w("**Dependências (catálogo)**");
    w();
    if (deps.length) {
      for (const dep of deps) {
        w(`- ${dep.kind} \`${dep.target}\`${dep.fields.length ? ` (${dep.fields.join(", ")})` : ""}`);
      }
      for (const dep of deps) {
        if (dep.kind === "procedure" && !seen.has(dep.target)) queue.push(dep.target);
      }
    } else {
      w("_(nenhuma registrada)_");
    }
    w();
    w("```sql");
    w(src.trimEnd() || "-- (fonte vazia no catálogo)");
    w("```");
    w();
  }
}

/* ------------------------------------------------------------------ */
/* 3. numeração                                                        */
/* ------------------------------------------------------------------ */

async function dumpGenerators() {
  const rows = await readOnlyQuery(`
    SELECT TRIM(RDB$GENERATOR_NAME) AS NAME
    FROM RDB$GENERATORS
    WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
    ORDER BY 1
  `);
  w("| Generator | Valor atual | Relevante para pedido? |");
  w("| --- | --- | --- |");
  for (const r of rows) {
    const name = String(r.NAME).trim();
    const relevant = /ORDEN|ORDEM|PEDIDO|VENDA|ITENS|EQUIP/i.test(name);
    if (!relevant) continue;
    // eslint-disable-next-line no-await-in-loop
    const cur = await readOnlyQuery(`SELECT GEN_ID(${name}, 0) AS VALOR FROM RDB$DATABASE`).catch(() => null);
    w(`| \`${name}\` | ${cur && cur[0] ? cur[0].VALOR : "?"} | sim |`);
  }
  w();
  w(`_Total de generators de usuário no banco: ${rows.length}._`);
  w();
}

function dumpNumberingEvidence() {
  w("Evidência extraída das fontes acima (busca literal por `N_PEDIDO` e `GEN_ID`):");
  w();
  const hits = [];
  for (const t of triggerIndex) {
    if (/N_PEDIDO/i.test(t.src)) hits.push({ kind: `trigger ${t.when} ${t.actions.join("+")} em ${t.table}`, name: t.name, src: t.src });
  }
  for (const p of procIndex) {
    if (/N_PEDIDO/i.test(p.src)) hits.push({ kind: "procedure", name: p.name, src: p.src });
  }
  if (!hits.length) {
    w("**Nenhum objeto do catálogo referencia `N_PEDIDO`.** Nesse caso o valor só");
    w("pode vir de default de coluna — verificar a seção de colunas.");
    w();
    return;
  }
  w("| Objeto | Tipo | Linhas que citam N_PEDIDO |");
  w("| --- | --- | --- |");
  for (const h of hits) {
    const lines = h.src
      .split("\n")
      .filter((l) => /N_PEDIDO/i.test(l))
      .map((l) => l.trim().replace(/\|/g, "\\|"))
      .slice(0, 12)
      .join("<br>");
    w(`| \`${h.name}\` | ${h.kind} | \`${lines}\` |`);
  }
  w();
  const gen = hits.find((h) => /GEN_ID/i.test(h.src));
  const max = hits.find((h) => /MAX\s*\(\s*N_PEDIDO/i.test(h.src));
  w(
    `**Conclusão automática:** ${
      max
        ? `\`${max.name}\` calcula \`N_PEDIDO\` por \`MAX()+1\` → **numeração sujeita a colisão sob concorrência**.`
        : gen
          ? `\`${gen.name}\` usa generator para numerar → numeração atômica no banco.`
          : "os objetos citam `N_PEDIDO` mas sem generator nem MAX() — ler as fontes acima antes de concluir."
    }`,
  );
  w();
}

/* ------------------------------------------------------------------ */
/* 4. campos automáticos                                               */
/* ------------------------------------------------------------------ */

async function dumpAutoFields(table) {
  const cols = await describeTable(table);
  if (!cols.length) {
    w(`\`${table}\`: tabela não encontrada.`);
    w();
    return;
  }
  const defaults = await readOnlyQuery(
    `
      SELECT
        TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
        rf.RDB$DEFAULT_SOURCE   AS COL_DEFAULT,
        f.RDB$DEFAULT_SOURCE    AS DOMAIN_DEFAULT,
        f.RDB$COMPUTED_SOURCE   AS COMPUTED
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE rf.RDB$RELATION_NAME = ?
    `,
    [table],
  );

  const meta = new Map();
  for (const d of defaults) {
    /* eslint-disable no-await-in-loop */
    const own = (await blobToString(d.COL_DEFAULT)).replace(/\s+/g, " ").trim();
    const dom = (await blobToString(d.DOMAIN_DEFAULT)).replace(/\s+/g, " ").trim();
    const comp = (await blobToString(d.COMPUTED)).replace(/\s+/g, " ").trim();
    /* eslint-enable no-await-in-loop */
    meta.set(String(d.FIELD_NAME).trim(), { def: own || dom, comp });
  }

  // colunas citadas como NEW.<coluna> = ... nas triggers desta tabela
  const assigned = new Map();
  for (const t of triggerIndex.filter((x) => x.table === table)) {
    const re = /NEW\.([A-Z0-9_$]+)\s*=/gi;
    let m = re.exec(t.src);
    while (m) {
      const col = m[1].toUpperCase();
      if (!assigned.has(col)) assigned.set(col, new Set());
      assigned.get(col).add(t.name);
      m = re.exec(t.src);
    }
  }

  w(`### \`${table}\``);
  w();
  w("| Coluna | Obrigatória | Default | Calculada | Atribuída por trigger |");
  w("| --- | --- | --- | --- | --- |");
  let anyAuto = false;
  for (const c of cols) {
    const name = String(c.FIELD_NAME).trim();
    const m = meta.get(name) || {};
    const byTrigger = assigned.get(name);
    const auto = Boolean(m.def || m.comp || byTrigger);
    if (!auto) continue;
    anyAuto = true;
    w(
      `| \`${name}\` | ${Number(c.NOT_NULL) === 1 ? "sim" : "não"} | ${m.def ? `\`${m.def}\`` : "—"} | ${
        m.comp ? `\`${m.comp}\`` : "—"
      } | ${byTrigger ? [...byTrigger].map((n) => `\`${n}\``).join(", ") : "—"} |`,
    );
  }
  if (!anyAuto) w("| _(nenhuma coluna preenchida automaticamente)_ | | | | |");
  w();
  const required = cols
    .filter((c) => Number(c.NOT_NULL) === 1)
    .map((c) => String(c.FIELD_NAME).trim())
    .filter((n) => !(meta.get(n) || {}).def && !(meta.get(n) || {}).comp && !assigned.has(n));
  w(`**Obrigatórias sem preenchimento automático (o chamador precisa fornecer):** ${required.length ? required.map((n) => `\`${n}\``).join(", ") : "nenhuma"}.`);
  w();
}

/* ------------------------------------------------------------------ */
/* 5. tabelas adicionais tocadas                                       */
/* ------------------------------------------------------------------ */

function dumpTouchedTables() {
  const touched = new Map();
  const add = (target, by) => {
    if (ROOT_TABLES.includes(target)) return;
    if (!touched.has(target)) touched.set(target, new Set());
    touched.get(target).add(by);
  };
  for (const p of procIndex) {
    for (const d of p.deps) if (d.kind.startsWith("tabela") || d.kind === "view") add(d.target, p.name);
  }
  for (const t of triggerIndex) {
    const re = /\b(?:INTO|FROM|JOIN)\s+([A-Z][A-Z0-9_$]*)/gi;
    let m = re.exec(t.src);
    while (m) {
      add(m[1].toUpperCase(), t.name);
      m = re.exec(t.src);
    }
  }
  if (!touched.size) {
    w("**Nenhuma tabela adicional é referenciada** pelas triggers/procedures da criação de pedidos, além das três tabelas raiz.");
    w();
    return;
  }
  w("| Tabela adicional | Referenciada por |");
  w("| --- | --- |");
  for (const [table, by] of [...touched.entries()].sort()) {
    w(`| \`${table}\` | ${[...by].map((n) => `\`${n}\``).join(", ")} |`);
  }
  w();
}

async function dumpDependentTables() {
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
  if (!rows.length) {
    w("Nenhuma FK declarada apontando para `ORDENS_VENDA`.");
    w();
    return;
  }
  w("| Tabela | Coluna FK |");
  w("| --- | --- |");
  for (const r of rows) w(`| \`${r.ORIGEM}\` | \`${r.CAMPO}\` |`);
  w();
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

runScript(async () => {
  w("# Sprint 6.1 — Código-fonte da criação de pedidos (ERP Firebird)");
  w();
  w(`> Gerado por \`scripts/inspect-order-source.js\` em ${new Date().toISOString()}.`);
  w("> **Somente leitura:** todo SQL passou pelo guard que recusa qualquer comando");
  w("> fora de `SELECT`. Nenhuma escrita foi realizada no Firebird.");
  w();
  w("## 1. Triggers");
  w();
  for (const t of ROOT_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await dumpTriggers(t);
  }
  w("## 2. Procedures");
  w();
  await dumpProcedures();
  w("## 3. Numeração do pedido");
  w();
  await dumpGenerators();
  dumpNumberingEvidence();
  w("## 4. Campos preenchidos automaticamente");
  w();
  for (const t of ROOT_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await dumpAutoFields(t);
  }
  w("## 5. Dependências");
  w();
  w("### Tabelas adicionais tocadas pelas procedures/triggers");
  w();
  dumpTouchedTables();
  w("### Tabelas com FK para `ORDENS_VENDA`");
  w();
  await dumpDependentTables();
  w("---");
  w();
  w("**Confirmação:** nenhuma escrita foi realizada no Firebird durante a geração deste relatório.");
  w();

  const text = out.join("\n");
  if (OUT_FILE) {
    const target = path.resolve(process.cwd(), OUT_FILE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, "utf8");
    // eslint-disable-next-line no-console
    console.log(`Relatório gravado em ${target} (${text.length} caracteres).`);
  } else {
    // eslint-disable-next-line no-console
    console.log(text);
  }
});
