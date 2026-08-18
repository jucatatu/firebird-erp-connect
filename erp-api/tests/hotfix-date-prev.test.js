const { toDateCivil } = require('../orders.mapper');

describe('toDateCivil Unit Tests', () => {
  test('should handle YYYY-MM-DDTHH:mm:ss (14:30)', () => {
    const input = "2026-08-18T14:30:00";
    const result = toDateCivil(input);
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7); // August is 7
    expect(result.getDate()).toBe(18);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });

  test('should handle YYYY-MM-DDTHH:mm (15:45)', () => {
    const input = "2026-08-18T15:45";
    const result = toDateCivil(input);
    
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(45);
  });

  test('should preserve 12:00 for plain date YYYY-MM-DD', () => {
    const input = "2026-08-18";
    const result = toDateCivil(input);
    
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  test('should return null for invalid input', () => {
    expect(toDateCivil(null)).toBeNull();
    expect(toDateCivil("")).toBeNull();
    expect(toDateCivil("invalid")).toBeNull();
  });
});
