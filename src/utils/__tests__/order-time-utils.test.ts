import { describe, it, expect } from 'vitest';
import { getCivilTime, normalizeTimeInput, isValidCivilTime, mergeCivilDateTime } from '../order-time-utils';

describe('Order Time Utils', () => {
  describe('getCivilTime', () => {
    it('should extract time from ISO string', () => {
      expect(getCivilTime('2026-08-18T16:30:00')).toBe('16:30');
      expect(getCivilTime('2026-08-18T08:05:00')).toBe('08:05');
    });

    it('should return empty string if no time present', () => {
      expect(getCivilTime('2026-08-18')).toBe('');
      expect(getCivilTime(null)).toBe('');
    });
  });

  describe('normalizeTimeInput', () => {
    it('should normalize partial digits', () => {
      expect(normalizeTimeInput('1630')).toBe('16:30');
      expect(normalizeTimeInput('830')).toBe('08:30');
      expect(normalizeTimeInput('0830')).toBe('08:30');
      expect(normalizeTimeInput('1')).toBe('01:00');
    });

    it('should handle digits with colon already present', () => {
      expect(normalizeTimeInput('16:30')).toBe('16:30');
    });

    it('should limit to 4 digits', () => {
      expect(normalizeTimeInput('12345')).toBe('12:34');
    });
  });

  describe('isValidCivilTime', () => {
    it('should validate 00:00 to 23:59', () => {
      expect(isValidCivilTime('00:00')).toBe(true);
      expect(isValidCivilTime('23:59')).toBe(true);
      expect(isValidCivilTime('12:00')).toBe(true);
    });

    it('should reject invalid hours or minutes', () => {
      expect(isValidCivilTime('24:00')).toBe(false);
      expect(isValidCivilTime('25:30')).toBe(false);
      expect(isValidCivilTime('12:60')).toBe(false);
      expect(isValidCivilTime('12:99')).toBe(false);
      expect(isValidCivilTime('aa:bb')).toBe(false);
    });
  });

  describe('mergeCivilDateTime', () => {
    it('should merge date and time correctly', () => {
      expect(mergeCivilDateTime('2026-08-18', '16:30')).toBe('2026-08-18T16:30:00');
    });

    it('should return only date if time is empty', () => {
      expect(mergeCivilDateTime('2026-08-18', '')).toBe('2026-08-18');
    });

    it('should handle already combined date strings', () => {
      expect(mergeCivilDateTime('2026-08-18T10:00:00', '16:30')).toBe('2026-08-18T16:30:00');
    });
  });
});
