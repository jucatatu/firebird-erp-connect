import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const SearchInput = z.object({
  q: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  companyId: z.union([z.literal(1), z.literal(3)]).optional(),
  limit: z.number().optional().default(20),
  cursor: z.number().optional()
});

describe('Sprint 8.5.2 - Zod Validation for Customer Search', () => {
  it('should accept q even if it has fewer than 3 characters', () => {
    const input = { q: "Ro", companyId: 1 };
    const result = SearchInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty q when filtering by company only', () => {
    const input = { companyId: 3 };
    const result = SearchInput.safeParse(input);
    expect(result.success).toBe(true);
  });
});
