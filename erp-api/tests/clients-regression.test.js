const { buildQPatterns } = require('../src/modules/clients/clients.mapper');
const assert = require('assert');

console.log('--- REGRESSÃO DE CLIENTES (SPRINT 8.5.7) ---');

const patterns = buildQPatterns('Romeu');
console.log('Patterns para "Romeu":', JSON.stringify(patterns));

// Antes da 8.5.4, Romeu virava %_OM_U% ou algo pior que casava com Edimar Miranda.
// Na 8.5.7 deve ser ["%ROMEU%", "%R_M_U%"]
assert.deepStrictEqual(patterns, ["%ROMEU%", "%R_M_U%"]);

console.log('OK: Regressão de Clientes passou.');
