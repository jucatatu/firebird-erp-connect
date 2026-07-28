"use strict";

/**
 * Introspecção de schema Firebird — SOMENTE LEITURA.
 *
 * Motivação: o schema do ERP não é controlado por este projeto. Colunas como
 * ATIVO, DELETED, BLOQUEADO ou ID_FPGTO podem ou não existir. Em vez de
 * assumir nomes, o módulo de clientes pergunta ao catálogo do banco quais
 * colunas realmente existem e monta o SELECT apenas com as confirmadas.
 * Campos não confirmados são devolvidos como `null` no contrato da API.
 *
 * O resultado é cacheado em memória por processo (o schema não muda em
 * runtime). Nenhum dado de negócio é cacheado aqui — apenas metadados.
 */

const firebird = require("./firebird-client");

/** @type {Map<string, Set<string>>} */
const columnCache = new Map();

function isValidIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z][A-Za-z0-9_$]{0,62}$/.test(name);
}

/**
 * Lista as colunas de uma tabela/view. Sempre em MAIÚSCULAS.
 * @returns {Promise<Set<string>>}
 */
async function getTableColumns(table) {
  const name = String(table || "").toUpperCase();
  if (!isValidIdentifier(name)) return new Set();
  if (columnCache.has(name)) return columnCache.get(name);

  const sql = `
    SELECT TRIM(rf.RDB$FIELD_NAME) AS FIELD
    FROM RDB$RELATION_FIELDS rf
    WHERE rf.RDB$RELATION_NAME = ?
  `;
  let rows = [];
  try {
    rows = (await firebird.executeQuery(sql, [name])) || [];
  } catch (_err) {
    // Falha de introspecção não deve derrubar a request: tratamos como
    // "nenhuma coluna confirmada" e o caller devolve null nos campos.
    return new Set();
  }
  const set = new Set();
  for (const row of rows) {
    const raw = row && (row.FIELD !== undefined ? row.FIELD : row.field);
    if (raw === undefined || raw === null) continue;
    const v = Buffer.isBuffer(raw) ? raw.toString("binary") : String(raw);
    const trimmed = v.trim().toUpperCase();
    if (trimmed) set.add(trimmed);
  }
  columnCache.set(name, set);
  return set;
}

/**
 * Retorna a primeira coluna existente dentre `candidates`, ou null.
 * Todos os candidatos passam por validação de identificador — nunca há
 * interpolação de entrada do usuário em SQL.
 */
async function pickExistingColumn(table, candidates) {
  const cols = await getTableColumns(table);
  for (const c of candidates || []) {
    const up = String(c || "").toUpperCase();
    if (isValidIdentifier(up) && cols.has(up)) return up;
  }
  return null;
}

async function hasColumn(table, column) {
  const cols = await getTableColumns(table);
  return cols.has(String(column || "").toUpperCase());
}

function clearCache() {
  columnCache.clear();
}

module.exports = {
  getTableColumns,
  pickExistingColumn,
  hasColumn,
  clearCache,
  isValidIdentifier,
};
