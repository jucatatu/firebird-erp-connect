import { describe, it, expect, vi } from 'vitest';
import { requirePermission } from '../permissions.server';

describe('requirePermission', () => {
  it('should throw PERMISSION_DENIED when RPC returns false', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    };

    await expect(
      requirePermission({
        userId: 'user-123',
        resource: 'commercial.orders',
        action: 'create',
        supabase: mockSupabase as any,
      })
    ).rejects.toThrow(/PERMISSION_DENIED/);
  });

  it('should return true when RPC returns true', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    const result = await requirePermission({
      userId: 'user-123',
      resource: 'commercial.orders',
      action: 'view',
      supabase: mockSupabase as any,
    });

    expect(result).toBe(true);
  });
});
