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

/**
 * Executa `fn(tx)` dentro de uma transação Firebird única.
 *
 * Contrato:
 *   - `tx.query(sql, params)` retorna Promise<Array<row>>
 *   - Se `fn` retornar, é feito COMMIT e o valor é devolvido ao caller.
 *   - Se `fn` lançar, é feito ROLLBACK integral e o erro é re-lançado.
 *   - Falhas de conexão/attach viram AppError ERP_UNAVAILABLE (503).
 *
 * Nenhum COMMIT/ROLLBACK intermediário é permitido — a semântica é atômica.
 */
async function withTransaction(fn) {
  let db;
  try {
    db = await attach();
    const tx = await new Promise((resolve, reject) => {
      const isolation = Firebird && Firebird.ISOLATION_READ_COMMITED;
      db.transaction(isolation, (err, t) => (err ? reject(err) : resolve(t)));
    });
    let committed = false;
    try {
      const txApi = {
        query: (sql, params = []) =>
          new Promise((resolve, reject) => {
            tx.query(sql, params, (err, rows) =>
              err ? reject(err) : resolve(rows || []),
            );
          }),
      };
      const result = await fn(txApi);
      await new Promise((resolve, reject) =>
        tx.commit((err) => (err ? reject(err) : resolve())),
      );
      committed = true;
      return result;
    } finally {
      if (!committed) {
        await new Promise((resolve) => {
          try {
            tx.rollback(() => resolve());
          } catch (_e) {
            resolve();
          }
        });
      }
    }
  } catch (err) {
    if (err && err.name === "AppError") throw err;
    logger.error({ code: err && err.code }, "erro em transação no ERP");
    throw new AppError({
      message: "ERP temporariamente indisponível.",
      statusCode: 503,
      code: "ERP_UNAVAILABLE",
      retryable: true,
      details: { cause: err && err.message },
    });
  } finally {
    if (db) await detach(db);
  }
}

module.exports = { executeQuery, ping, withTransaction };