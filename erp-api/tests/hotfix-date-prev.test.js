const { test, describe } = require('node:test');
const assert = require('node:assert');
const { toDateCivil } = require('../src/modules/orders/orders.mapper');

describe('toDateCivil Unit Tests', () => {
  test('should handle YYYY-MM-DDTHH:mm:ss (14:30)', () => {
    const input = "2026-08-18T14:30:00";
    const result = toDateCivil(input);
    
    assert.strictEqual(result.getFullYear(), 2026);
    assert.strictEqual(result.getMonth(), 7); // August is 7
    assert.strictEqual(result.getDate(), 18);
    assert.strictEqual(result.getHours(), 14);
    assert.strictEqual(result.getMinutes(), 30);
    assert.strictEqual(result.getSeconds(), 0);
  });

  test('should handle YYYY-MM-DDTHH:mm (15:45)', () => {
    const input = "2026-08-18T15:45";
    const result = toDateCivil(input);
    
    assert.strictEqual(result.getHours(), 15);
    assert.strictEqual(result.getMinutes(), 45);
  });

  test('should preserve 12:00 for plain date YYYY-MM-DD', () => {
    const input = "2026-08-18";
    const result = toDateCivil(input);
    
    assert.strictEqual(result.getHours(), 12);
    assert.strictEqual(result.getMinutes(), 0);
  });

  test('should return null for invalid input', () => {
    assert.strictEqual(toDateCivil(null), null);
    assert.strictEqual(toDateCivil(""), null);
    assert.strictEqual(toDateCivil("invalid"), null);
  });
});
