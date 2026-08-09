const { buildQPatterns } = require('../src/shared/search/like-pattern');
const assert = require('assert');

console.log('--- TESTANDO HELPER LIKE-PATTERN (SPRINT 8.5.7) ---');

const cases = [
  { input: 'Ipa', expected: ['%IPA%'], desc: 'Ipa (3 chars, vira _P_, literal=1) -> Bloqueia folding' },
  { input: 'Pil', expected: ['%PIL%', '%P_L%'], desc: 'Pil (I vira _, P e L literais=2) -> Mantém folding' },
  { input: 'Romeu', expected: ['%ROMEU%', '%R_M_U%'], desc: 'Romeu -> Mantém folding (limite 2 coringas)' },
  { input: 'Joao', expected: ['%JOAO%', '%J__O%'], desc: 'Joao -> Mantém folding (limite 2 coringas)' },
  { input: 'Jose', expected: ['%JOSE%', '%J_S_%'], desc: 'Jose -> Mantém folding' },
  { input: 'Acucar', expected: ['%ACUCAR%', '%_C_CAR%'], desc: 'Acucar -> Mantém folding (A e U viram _, C, C, A, R literais)' }
];

cases.forEach(c => {
  const patterns = buildQPatterns(c.input);
  console.log(`INPUT: "${c.input}" | PATTERNS: ${JSON.stringify(patterns)} | ${c.desc}`);
  assert.deepStrictEqual(patterns, c.expected);
});

console.log('OK: Todos os casos do helper passaram.');
