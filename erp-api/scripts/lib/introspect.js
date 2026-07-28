"use strict";

/**
 * Utilitários compartilhados pelos scripts administrativos de introspecção.
 *
 * GARANTIAS:
 *   - SOMENTE LEITURA: `readOnlyQuery` recusa qualquer SQL que não comece
 *     com SELECT e bloqueia palavras-chave de escrita/DDL.
 *   - Reutiliza a conexão segura já existente (src/shared/database).
 *     Nenhuma credencial é redefinida, lida ou impressa aqui.
 *   - Nunca imprime dados pessoais: apenas metadados do catálogo e
 *     contagens agregadas.
 */

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|GRANT|REVOKE|EXECUTE\s+PROCEDURE|SET\s+GENERATOR|COMMIT|ROLLBACK|RECREATE|TRUNCATE)\b/i;

function assertReadOnly(sql) {
  const normalized = String(sql || "").trim();
  if (!/^SELECT\b/i.test(normalized)) {
    throw new Error("read_only_violation: apenas SELECT é permitido nos scripts de introspecção.");
  }
  if (FORBIDDEN.test(normalized)) {
    throw new Error("read_only_violation: palavra-chave de escrita detectada.");
  }
  return true;
}

function getClient() {
  // eslint-disable-next-line global-require
  return require("../../src/shared/database/firebird-client");
}

async function readOnlyQuery(sql, params = []) {
  assertReadOnly(sql);
  return getClient().executeQuery(sql, params);
}

/** Lista colunas + tipo + nullability de uma tabela. */
async function describeTable(table) {
  const sql = `
    SELECT
      TRIM(rf.RDB$FIELD_NAME)        AS FIELD_NAME,
      f.RDB$FIELD_TYPE               AS FIELD_TYPE,
      f.RDB$FIELD_SUB_TYPE           AS FIELD_SUB_TYPE,
      f.RDB$FIELD_LENGTH             AS FIELD_LENGTH,
      f.RDB$FIELD_SCALE              AS FIELD_SCALE,
      COALESCE(rf.RDB$NULL_FLAG, 0)  AS NOT_NULL
    FROM RDB$RELATION_FIELDS rf
    JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
    WHERE rf.RDB$RELATION_NAME = ?
    ORDER BY rf.RDB$FIELD_POSITION
  `;
  return readOnlyQuery(sql, [String(table).toUpperCase()]);
}

async function tableExists(table) {
  const sql = `
    SELECT FIRST 1 TRIM(RDB$RELATION_NAME) AS NAME
    FROM RDB$RELATIONS
    WHERE RDB$RELATION_NAME = ?
  `;
  const rows = await readOnlyQuery(sql, [String(table).toUpperCase()]);
  return Array.isArray(rows) && rows.length > 0;
}

/** Índices e constraints (PK/FK/UNIQUE) da tabela. */
async function describeIndexes(table) {
  const sql = `
    SELECT
      TRIM(i.RDB$INDEX_NAME)       AS INDEX_NAME,
      TRIM(COALESCE(rc.RDB$CONSTRAINT_TYPE, '')) AS CONSTRAINT_TYPE,
      COALESCE(i.RDB$UNIQUE_FLAG, 0) AS IS_UNIQUE,
      TRIM(COALESCE(s.RDB$FIELD_NAME, '')) AS FIELD_NAME
    FROM RDB$INDICES i
    LEFT JOIN RDB$INDEX_SEGMENTS s ON s.RDB$INDEX_NAME = i.RDB$INDEX_NAME
    LEFT JOIN RDB$RELATION_CONSTRAINTS rc ON rc.RDB$INDEX_NAME = i.RDB$INDEX_NAME
    WHERE i.RDB$RELATION_NAME = ?
    ORDER BY i.RDB$INDEX_NAME, s.RDB$FIELD_POSITION
  `;
  return readOnlyQuery(sql, [String(table).toUpperCase()]);
}

/** Chaves estrangeiras declaradas na tabela (origem → destino). */
async function describeForeignKeys(table) {
  const sql = `
    SELECT
      TRIM(rc.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME,
      TRIM(seg.RDB$FIELD_NAME)     AS FIELD_NAME,
      TRIM(i2.RDB$RELATION_NAME)   AS REFERENCED_TABLE
    FROM RDB$RELATION_CONSTRAINTS rc
    JOIN RDB$REF_CONSTRAINTS ref ON ref.RDB$CONSTRAINT_NAME = rc.RDB$CONSTRAINT_NAME
    JOIN RDB$INDEX_SEGMENTS seg  ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
    JOIN RDB$INDICES i2          ON i2.RDB$INDEX_NAME = ref.RDB$CONST_NAME_UQ
    WHERE rc.RDB$RELATION_NAME = ?
      AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
    ORDER BY rc.RDB$CONSTRAINT_NAME
  `;
  return readOnlyQuery(sql, [String(table).toUpperCase()]);
}

const TYPE_NAMES = {
  7: "SMALLINT",
  8: "INTEGER",
  10: "FLOAT",
  12: "DATE",
  13: "TIME",
  14: "CHAR",
  16: "BIGINT/NUMERIC",
  27: "DOUBLE",
  35: "TIMESTAMP",
  37: "VARCHAR",
  261: "BLOB",
};

function typeName(row) {
  const t = Number(row.FIELD_TYPE);
  const base = TYPE_NAMES[t] || `TYPE_${t}`;
  const len = row.FIELD_LENGTH ? `(${row.FIELD_LENGTH})` : "";
  const scale = row.FIELD_SCALE ? ` scale=${row.FIELD_SCALE}` : "";
  return `${base}${len}${scale}`;
}

/** Impressão padronizada — NUNCA imprime linhas de dados de clientes. */
async function report(table, { fks = true, indexes = true } = {}) {
  const exists = await tableExists(table);
  // eslint-disable-next-line no-console
  console.log(`\n=== ${String(table).toUpperCase()} — ${exists ? "ENCONTRADA" : "NÃO ENCONTRADA"}`);
  if (!exists) return { exists: false, columns: [] };
  const cols = await describeTable(table);
  for (const c of cols) {
    // eslint-disable-next-line no-console
    console.log(
      `  ${String(c.FIELD_NAME).padEnd(30)} ${typeName(c).padEnd(20)} ${Number(c.NOT_NULL) === 1 ? "NOT NULL" : ""}`,
    );
  }
  if (indexes) {
    const idx = await describeIndexes(table);
    if (idx.length) {
      // eslint-disable-next-line no-console
      console.log("  -- índices:");
      for (const i of idx) {
        // eslint-disable-next-line no-console
        console.log(
          `     ${String(i.INDEX_NAME).padEnd(32)} ${i.CONSTRAINT_TYPE || ""} ${Number(i.IS_UNIQUE) === 1 ? "UNIQUE" : ""} (${i.FIELD_NAME})`,
        );
      }
    }
  }
  if (fks) {
    const rels = await describeForeignKeys(table);
    if (rels.length) {
      // eslint-disable-next-line no-console
      console.log("  -- chaves estrangeiras:");
      for (const r of rels) {
        // eslint-disable-next-line no-console
        console.log(`     ${r.FIELD_NAME} → ${r.REFERENCED_TABLE}`);
      }
    }
  }
  return { exists: true, columns: cols.map((c) => String(c.FIELD_NAME).trim()) };
}

/** Contagem agregada (nunca imprime conteúdo de linhas). */
async function countRows(table) {
  if (!/^[A-Za-z][A-Za-z0-9_$]*$/.test(table)) return null;
  const rows = await readOnlyQuery(`SELECT COUNT(*) AS TOTAL FROM ${table.toUpperCase()}`);
  return rows && rows[0] ? Number(rows[0].TOTAL) : null;
}

function sanitizeScriptErrorText(value) {
  const text = String(value || "").trim();
  if (!text) return "falha não detalhada";

  return text
    .replace(/\b(?:SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|GRANT|REVOKE|EXECUTE)\b[\s\S]*/gi, "[comando omitido]")
    .replace(
      /\b(?:password|passwd|pwd|user|uid|username|host|server|database|db|path|filename|file|data\s+source)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s;,)]+)/gi,
      (match) => match.replace(/[:=]\s*("[^"]*"|'[^']*'|[^\s;,)]+)/, "=[omitido]"),
    )
    .replace(/\b(?:[A-Za-z]:[\\/]|\\\\|\/)[^\s'")]+/g, "[caminho omitido]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[host omitido]")
    .replace(/\b(?:SYSDBA|masterkey)\b/gi, "[credencial omitida]")
    .trim();
}

function safeScriptErrorMessage(err) {
  const parts = [];
  if (err && err.name && err.name !== "Error") parts.push(String(err.name));
  if (err && err.code) parts.push(`code=${sanitizeScriptErrorText(err.code)}`);

  const rawMessage = err && err.message ? err.message : err;
  const message = sanitizeScriptErrorText(rawMessage);
  if (message) parts.push(message);

  return parts.length ? parts.join(": ") : "falha não detalhada";
}

function runScript(main) {
  return Promise.resolve()
    .then(() => main())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`ERRO: ${safeScriptErrorMessage(err)}`);
      process.exitCode = 1;
    });
}

module.exports = {
  assertReadOnly,
  readOnlyQuery,
  describeTable,
  describeIndexes,
  describeForeignKeys,
  tableExists,
  typeName,
  report,
  countRows,
  runScript,
};
