"use strict";

/**
 * Padrões LIKE seguros para busca textual no Firebird.
 * 
 * Sprint 8.9.6: Removido accent folding baseado em coringa "_" para evitar falsos positivos.
 * Agora utiliza busca SUBSTRING + CASE-INSENSITIVE + ACCENT-INSENSITIVE via normalização.
 */

/** Remove acentos do termo digitado (NFD + strip de diacríticos). */
function stripAccents(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** 
 * Normaliza o termo de busca para comparação literal.
 * Remove acentos, passa para maiúsculas e neutraliza coringas digitados pelo usuário.
 */
function normalizeTerm(term) {
  return stripAccents(term)
    .toUpperCase()
    .replace(/[%_]/g, " ")
    .trim();
}

/** 
 * Gera uma expressão SQL que remove acentos de uma coluna no Firebird.
 * Utiliza múltiplos REPLACE encadeados.
 */
function accentInsensitiveSqlExpression(columnExpression) {
  let sql = `UPPER(${columnExpression})`;
  
  // Mapeamento de normalização (Baseado na regra funcional v1.8.6)
  const replacements = [
    ["Á", "A"], ["À", "A"], ["Ã", "A"], ["Â", "A"], ["Ä", "A"],
    ["É", "E"], ["È", "E"], ["Ê", "E"], ["Ë", "E"],
    ["Í", "I"], ["Ì", "I"], ["Î", "I"], ["Ï", "I"],
    ["Ó", "O"], ["Ò", "O"], ["Õ", "O"], ["Ô", "O"], ["Ö", "O"],
    ["Ú", "U"], ["Ù", "U"], ["Û", "U"], ["Ü", "U"],
    ["Ç", "C"], ["Ñ", "N"]
  ];

  for (const [from, to] of replacements) {
    sql = `REPLACE(${sql}, '${from}', '${to}')`;
  }

  return sql;
}

/** Padrão exato (sem folding), já em maiúsculas e sem coringas do usuário. */
function exactLikePattern(term) {
  const upper = normalizeTerm(term);
  return upper ? `%${upper}%` : "%%";
}

/** 
 * Sprint 8.9.6: buildQPatterns agora retorna apenas o padrão exato normalizado.
 * O folding baseado em "_" foi descontinuado para evitar falsos positivos como "Potus" -> "P_T_S".
 */
function buildQPatterns(term) {
  const exact = exactLikePattern(term);
  return [exact];
}

module.exports = { 
  stripAccents, 
  normalizeTerm,
  exactLikePattern, 
  buildQPatterns,
  accentInsensitiveSqlExpression 
};
