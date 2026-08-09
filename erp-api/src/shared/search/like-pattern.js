"use strict";

/**
 * Padrões LIKE seguros para busca textual no Firebird.
 * 
 * Atualizado na Sprint 8.5.7 para prevenir padrões excessivamente genéricos.
 */

const ACCENT_CLASSES = "AEIOUCN";

/** Remove acentos do termo digitado (NFD + strip de diacríticos). */
function stripAccents(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeTerm(term) {
  return stripAccents(term)
    .toUpperCase()
    .replace(/[%_]/g, " ")
    .trim();
}

/** Padrão exato (sem folding), já em maiúsculas e sem coringas do usuário. */
function exactLikePattern(term) {
  const upper = normalizeTerm(term);
  return upper ? `%${upper}%` : "%%";
}

/** 
 * Padrão com folding de acentos.
 * 
 * Regra de Segurança Sprint 8.5.7:
 * - Limite de 2 coringas por termo.
 * - Deve preservar pelo menos 2 caracteres literais fixos (não coringas).
 */
function foldToLikePattern(term) {
  const normalized = normalizeTerm(term);
  if (!normalized) return "%%";

  let out = "";
  let wildcardsCount = 0;
  let literalCount = 0;

  for (const ch of normalized) {
    if (ACCENT_CLASSES.includes(ch)) {
      if (wildcardsCount < 2) {
        out += "_";
        wildcardsCount++;
      } else {
        out += ch;
        literalCount++;
      }
    } else {
      out += ch;
      literalCount++;
    }
  }

  // Se o folding resultou em algo muito vago (ex: Ipa -> _P_),
  // invalidamos o pattern aproximado retornando null.
  if (literalCount < 2) {
    return null;
  }

  return `%${out}%`;
}

/** Padrão exato + padrão com folding seguro. */
function buildQPatterns(term) {
  const exact = exactLikePattern(term);
  if (term.length < 3) return [exact];

  const folded = foldToLikePattern(term);
  
  // Se folded for nulo ou igual ao exato, usamos apenas o exato.
  if (!folded || folded === exact) {
    return [exact];
  }

  return [exact, folded];
}

module.exports = { stripAccents, exactLikePattern, foldToLikePattern, buildQPatterns };
