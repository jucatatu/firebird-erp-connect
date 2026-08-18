import { describe, it, expect, vi } from 'vitest';
import { requirePermission, PermissionDeniedError, PermissionCheckError } from '../permissions.server';

describe('requirePermission', () => {
  it('should throw PermissionDeniedError (403) when RPC returns false', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    };

    try {
      await requirePermission({
        userId: 'user-123',
        resource: 'commercial.orders',
        action: 'create',
        supabase: mockSupabase as any,
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect(error.status).toBe(403);
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.details).toEqual({ resource: 'commercial.orders', action: 'create' });
    }
  });

  it('should throw PermissionCheckError (500) when RPC fails technically', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
    };

    try {
      await requirePermission({
        userId: 'user-123',
        resource: 'commercial.orders',
        action: 'create',
        supabase: mockSupabase as any,
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(PermissionCheckError);
      expect(error.status).toBe(500);
      expect(error.code).toBe('PERMISSION_CHECK_FAILED');
    }
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