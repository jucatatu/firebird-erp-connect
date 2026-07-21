"use strict";

let Firebird;
try {
  // eslint-disable-next-line global-require
  Firebird = require("node-firebird");
} catch (_e) {
  Firebird = null;
}
const { firebirdOptions } = require("../../config/firebird");
const { logger } = require("../../config/logger");
const { AppError } = require("../errors/app-error");

function attach() {
  return new Promise((resolve, reject) => {
    if (!Firebird) return reject(new Error("driver_unavailable"));
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
    // Log interno mínimo. Nunca logamos SQL, parâmetros, host, path do banco
    // ou credenciais. Apenas o code do driver para diagnóstico.
    logger.error({ code: err && err.code }, "erro no acesso ao ERP");
    throw new AppError({
      message: "ERP temporariamente indisponível.",
      statusCode: 503,
      code: "ERP_UNAVAILABLE",
      retryable: true,
      // 'cause' fica apenas em memória para debug local; nunca é serializado ao cliente
      details: { cause: err && err.message },
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