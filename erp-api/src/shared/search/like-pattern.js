"use strict";

/**
 * Padrões LIKE seguros para busca textual no Firebird.
 *
 * O Firebird desta instalação usa WIN1252 e a collation padrão NÃO é
 * accent-insensitive (comprovado em `scripts/diagnose-search-collation.js`,
 * Sprint 2). Em vez de carregar o cadastro para filtrar em memória, o termo
 * vira um padrão LIKE onde cada letra com variantes acentuadas é trocada
 * pelo coringa de UM caractere (`_`).
 *
 *   "Eletrica" → "%_L_TR_C_%"  casa com ELETRICA e ELÉTRICA
 *   "Garrafao" → "%G_RR_F__%"  casa com GARRAFAO e GARRAFÃO
 *
 * O padrão é sempre um VALOR parametrizado — nunca é concatenado na SQL.
 * Coringas digitados pelo usuário (`%`, `_`) são neutralizados.
 *
 * Este módulo é compartilhado por products e equipment-types (reutilização
 * concreta). O módulo de clientes mantém sua própria cópia intocada.
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
  return `%${String(term).toUpperCase().replace(/[%_]/g, " ").trim()}%`;
}

/** Padrão com folding de acentos. */
function foldToLikePattern(term) {
  let out = "";
  for (const ch of normalizeTerm(term)) {
    out += ACCENT_CLASSES.includes(ch) ? "_" : ch;
  }
  return `%${out}%`;
}

/** Padrão exato + padrão com folding (sem duplicar quando são iguais). */
function buildQPatterns(term) {
  const exact = exactLikePattern(term);
  const folded = foldToLikePattern(term);
  return folded === exact ? [exact] : [exact, folded];
}

module.exports = { stripAccents, exactLikePattern, foldToLikePattern, buildQPatterns };