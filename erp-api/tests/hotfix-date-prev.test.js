import { describe, it, expect } from 'vitest';
import { toDateCivil } from '../orders.mapper';

describe('Order Date Mapper (toDateCivil)', () => {
  it('should parse YYYY-MM-DD correctly (noon fallback)', () => {
    const d = toDateCivil('2026-08-18');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // Aug is 7
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(12);
  });

  it('should parse YYYY-MM-DDTHH:mm:ss correctly (civil time)', () => {
    const d = toDateCivil('2026-08-18T16:30:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(30);
  });

  it('should handle partial seconds or minutes', () => {
    const d = toDateCivil('2026-08-18T08:05');
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(5);
  });
});
