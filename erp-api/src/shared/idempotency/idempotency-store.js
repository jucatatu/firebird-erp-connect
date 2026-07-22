"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { env } = require("../../config/env");
const { logger } = require("../../config/logger");
const { AppError } = require("../errors/app-error");

/**
 * Interface conceitual:
 *   get(key)                 → entry | null
 *   put(key, entry)          → void   (persistente)
 *   withLock(key, fn)        → resultado de fn(), serializado por chave (in-process)
 *
 * Entry: { requestHash, status, body, createdAt, expiresAt }
 *
 * IMPORTANTE: `withLock` é apenas in-process. Em multi-instância,
 * substituir por Redis/DB.
 *
 * ── Janela residual de duplicação (documentar honestamente) ────────────
 * Sequência do createOrder:
 *   1. begin tx no Firebird
 *   2. SP_CAD_ORDEM_VENDA_COMPLETO + itens + equipamentos
 *   3. COMMIT no Firebird
 *   4. store.put(key, entry) — grava resultado da idempotência em disco
 *
 * Se o processo cair ENTRE 3 e 4, o COMMIT já persistiu o pedido no ERP
 * mas o cliente pode fazer retry com a mesma Idempotency-Key e o Node
 * NÃO encontrará o registro — vai criar um SEGUNDO pedido.
 *
 * Portanto NÃO afirmamos garantia exactly-once. Para eliminá-la é
 * necessário coordenação transacional (ex.: registrar Idempotency-Key
 * no próprio Firebird dentro da mesma transação) ou identificador
 * externo persistido no ERP — fora do escopo desta fase.
 */

const TTL_MS = env.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;

function hashPayload(raw) {
  return crypto.createHash("sha256").update(raw || "").digest("hex");
}

// ── locks in-process ────────────────────────────────────────────────────
const locks = new Map(); // key -> Promise atual
async function withLockGeneric(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const p = new Promise((r) => (release = r));
  locks.set(key, prev.then(() => p));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    // Limpeza best-effort. Chaves de curta duração (>= TTL) permanecem.
    if (locks.get(key) === p) locks.delete(key);
  }
}

// ── Memory store (default; NÃO permitido em produção) ───────────────────
function createMemoryStore() {
  const data = new Map();
  return {
    kind: "memory",
    async init() {},
    async get(key) {
      const e = data.get(key);
      if (!e) return null;
      if (e.expiresAt < Date.now()) {
        data.delete(key);
        return null;
      }
      return e;
    },
    async put(key, entry) {
      data.set(key, entry);
    },
    withLock: withLockGeneric,
  };
}

// ── File store (JSON, escrita atômica via rename) ───────────────────────
function createFileStore(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  let cache = null; // { [key]: entry }
  let writeChain = Promise.resolve();

  async function load() {
    if (cache !== null) return cache;
    try {
      const raw = await fsp.readFile(absPath, "utf8");
      const parsed = JSON.parse(raw);
      cache = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      if (err && err.code === "ENOENT") {
        cache = {};
      } else {
        logger.error(
          { code: err && err.code, path: absPath },
          "idempotency: falha ao carregar store de arquivo",
        );
        throw new AppError({
          message: "Store de idempotência indisponível.",
          statusCode: 503,
          code: "IDEMPOTENCY_STORE_UNAVAILABLE",
          retryable: true,
        });
      }
    }
    return cache;
  }

  async function persist() {
    const snapshot = JSON.stringify(cache);
    const dir = path.dirname(absPath);
    try {
      await fsp.mkdir(dir, { recursive: true });
      const tmp = `${absPath}.${process.pid}.${Date.now()}.tmp`;
      await fsp.writeFile(tmp, snapshot, "utf8");
      await fsp.rename(tmp, absPath);
    } catch (err) {
      logger.error(
        { code: err && err.code, path: absPath },
        "idempotency: volume não gravável",
      );
      throw new AppError({
        message: "Store de idempotência indisponível.",
        statusCode: 503,
        code: "IDEMPOTENCY_STORE_UNAVAILABLE",
        retryable: true,
      });
    }
  }

  function gc() {
    if (!cache) return;
    const now = Date.now();
    for (const [k, v] of Object.entries(cache)) {
      if (!v || typeof v !== "object" || v.expiresAt < now) delete cache[k];
    }
  }

  return {
    kind: "file",
    async init() {
      await fsp.mkdir(path.dirname(absPath), { recursive: true });
      await load();
      gc();
    },
    async get(key) {
      await load();
      const e = cache[key];
      if (!e) return null;
      if (e.expiresAt < Date.now()) {
        delete cache[key];
        return null;
      }
      return e;
    },
    async put(key, entry) {
      await load();
      cache[key] = entry;
      gc();
      // Serializa escritas no processo.
      writeChain = writeChain.then(persist, persist);
      await writeChain;
    },
    withLock: withLockGeneric,
  };
}

let instance = null;
function getStore() {
  if (instance) return instance;
  if (env.IDEMPOTENCY_STORE === "file") {
    const p = path.isAbsolute(env.IDEMPOTENCY_FILE_PATH)
      ? env.IDEMPOTENCY_FILE_PATH
      : path.resolve(process.cwd(), env.IDEMPOTENCY_FILE_PATH);
    instance = createFileStore(p);
  } else {
    instance = createMemoryStore();
  }
  return instance;
}

/**
 * Guard obrigatório: em produção o store DEVE ser persistente.
 * Retorna AppError pronta se o ambiente não estiver apto.
 */
function assertProductionReady() {
  if (env.NODE_ENV === "production" && env.IDEMPOTENCY_STORE !== "file") {
    throw new AppError({
      message:
        "Store de idempotência não persistente. Configure IDEMPOTENCY_STORE=file.",
      statusCode: 503,
      code: "IDEMPOTENCY_NOT_READY",
      retryable: false,
    });
  }
}

function buildEntry({ requestHash, status, body }) {
  const now = Date.now();
  return {
    requestHash,
    status,
    body,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
}

// Hooks para testes.
function _resetForTests() {
  instance = null;
  locks.clear();
}

module.exports = {
  getStore,
  hashPayload,
  buildEntry,
  assertProductionReady,
  _resetForTests,
};