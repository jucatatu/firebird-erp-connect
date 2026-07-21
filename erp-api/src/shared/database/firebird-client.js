"use strict";

const Firebird = require("node-firebird");
const { firebirdOptions } = require("../../config/firebird");
const { logger } = require("../../config/logger");
const { AppError } = require("../errors/app-error");

function attach() {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function detach(db) {
  return new Promise((resolve) => {
    try {
      db.detach(() => resolve());
    } catch (_e) {
      resolve();
    }
  });
}

/**
 * Executa uma consulta parametrizada no Firebird.
 * Nunca vaza SQL, credenciais ou stack do driver ao caller.
 */
async function executeQuery(sql, params = []) {
  let db;
  try {
    db = await attach();
    const rows = await query(db, sql, params);
    return rows;
  } catch (err) {
    logger.error(
      { err: { message: err && err.message, code: err && err.code } },
      "Erro no Firebird",
    );
    throw new AppError({
      message: "ERP temporariamente indisponível.",
      statusCode: 503,
      code: "ERP_UNAVAILABLE",
      retryable: true,
    });
  } finally {
    if (db) await detach(db);
  }
}

async function ping() {
  await executeQuery("SELECT 1 AS OK FROM RDB$DATABASE", []);
  return true;
}

module.exports = { executeQuery, ping };