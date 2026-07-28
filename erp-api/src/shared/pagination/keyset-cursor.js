"use strict";

/**
 * Cursor keyset OPACO para o consumidor da API.
 *
 * Formato interno: Base64URL de `{"v":1,"lastId":<int>}`.
 * Nada além disso é aceito: nenhum SQL, nome de coluna, limite ou qualquer
 * outro parâmetro interno pode trafegar dentro do cursor. A decodificação
 * valida versão, formato, tipo e faixa; qualquer desvio devolve `null` e o
 * caller responde 400 VALIDATION_ERROR.
 */

const CURSOR_VERSION = 1;
const MAX_ID = 2147483647;
const MAX_CURSOR_LENGTH = 128;

function encodeCursor(lastId) {
  if (!Number.isInteger(lastId) || lastId < 0 || lastId > MAX_ID) return null;
  const payload = JSON.stringify({ v: CURSOR_VERSION, lastId });
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * @returns {{lastId: number}|null} null quando o cursor é inválido.
 */
function decodeCursor(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (_err) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (parsed.v !== CURSOR_VERSION) return null;
  const keys = Object.keys(parsed);
  if (keys.length !== 2 || !keys.includes("lastId")) return null;
  const { lastId } = parsed;
  if (!Number.isInteger(lastId) || lastId < 0 || lastId > MAX_ID) return null;
  return { lastId };
}

module.exports = { CURSOR_VERSION, MAX_ID, encodeCursor, decodeCursor };