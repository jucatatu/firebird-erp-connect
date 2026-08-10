const { buildQPatterns, normalizeTerm } = require('../src/shared/search/like-pattern');
const assert = require('assert');

console.log('--- TESTANDO HELPER LIKE-PATTERN (SPRINT 8.9.6) ---');

const cases = [
  { input: 'Potus', expected: ['%POTUS%'], desc: 'Potus -> Somente literal normalizado' },
  { input: 'Jose', expected: ['%JOSE%'], desc: 'Jose -> Somente literal normalizado' },
  { input: 'José', expected: ['%JOSE%'], desc: 'José (com acento) -> Somente literal normalizado' },
  { input: 'Joao', expected: ['%JOAO%'], desc: 'Joao -> Somente literal normalizado' },
  { input: 'João', expected: ['%JOAO%'], desc: 'João (com acento) -> Somente literal normalizado' },
  { input: 'Acucar', expected: ['%ACUCAR%'], desc: 'Acucar -> Somente literal normalizado' },
  { input: 'Açúcar', expected: ['%ACUCAR%'], desc: 'Açúcar (com acento) -> Somente literal normalizado' },
  { input: 'Ipa', expected: ['%IPA%'], desc: 'Ipa -> Somente literal normalizado' },
  { input: 'Pil', expected: ['%PIL%'], desc: 'Pil -> Somente literal normalizado' },
  { input: 'Romeu', expected: ['%ROMEU%'], desc: 'Romeu -> Somente literal normalizado' },
  { input: 'Pet%', expected: ['%PET%'], desc: 'Neutralização de %' },
  { input: 'Pet_S', expected: ['%PET S%'], desc: 'Neutralização de _' }
];

cases.forEach(c => {
  const patterns = buildQPatterns(c.input);
  console.log(`INPUT: "${c.input}" | PATTERNS: ${JSON.stringify(patterns)} | ${c.desc}`);
  assert.deepStrictEqual(patterns, c.expected);
});

console.log('\n--- TESTE DE FALSO POSITIVO (POTUS) ---');
const potusPattern = buildQPatterns('Potus')[0];
const fakeMatch1 = "CANIL PET SHOP HANDREYAS";
const fakeMatch2 = "BOABOCA RESTAURANTE E PETISCARIA LTDA";

// Simulando a lógica de comparação
function simulaMatch(pattern, text) {
  const normalizedText = normalizeTerm(text);
  const regexBody = pattern.replace(/%/g, '.*');
  const regex = new RegExp(`^${regexBody}$`, 'i');
  return regex.test(normalizedText);
}

const match1 = simulaMatch(potusPattern, fakeMatch1);
const match2 = simulaMatch(potusPattern, fakeMatch2);

console.log(`Pattern: ${potusPattern}`);
console.log(`"${fakeMatch1}" match? ${match1}`);
console.log(`"${fakeMatch2}" match? ${match2}`);

assert.strictEqual(match1, false, 'Potus NÃO deve casar com PET SHOP');
assert.strictEqual(match2, false, 'Potus NÃO deve casar com PETISCARIA');

console.log('\nOK: Todos os casos de teste da Sprint 8.9.6 passaram.');
