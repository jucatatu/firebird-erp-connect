import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUser } from '../admin-users-invite.functions';
import { updateUser } from '../admin-users-update.functions';
import { updatePermissionProfile } from '../admin-profiles-crud.functions';

// Mock supabaseAdmin
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
        deleteUser: vi.fn(),
      }
    },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      }))
    }))
  }
}));

// Mock permissions.server
vi.mock('../permissions.server', () => ({
  requirePermission: vi.fn(() => Promise.resolve(true))
}));

// Mock auth-middleware
vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: vi.fn((ctx) => ctx)
}));

import { supabaseAdmin } from '@/integrations/supabase/client.server';

describe('Admin Hardening Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Company Allowlist', () => {
    it('should reject invalid company IDs in inviteUser (Zod)', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1, 2], // 2 is invalid
        roles: ['vendedor'] as any,
        erpSellerId: null
      };

      await expect(inviteUser({ data, context })).rejects.toThrow();
    });

    it('should accept valid company IDs [1, 3] in inviteUser', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1, 3],
        roles: ['vendedor'] as any,
        erpSellerId: null
      };

      (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      const result = await inviteUser({ data, context });
      expect(result.success).toBe(true);
    });
  });

  describe('System Profile Protection', () => {
    it('should reject renaming a system profile', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        id: 'system-profile-id',
        name: 'New Name',
        active: true
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { is_system: true, name: 'Administrador', active: true } 
            })
          })
        })
      });

      await expect(updatePermissionProfile({ data, context })).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
    });

    it('should reject deactivating a system profile', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        id: 'system-profile-id',
        name: 'Administrador',
        active: false
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { is_system: true, name: 'Administrador', active: true } 
            })
          })
        })
      });

      await expect(updatePermissionProfile({ data, context })).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
    });
  });

  describe('ERP Seller Immutability', () => {
    it('should ignore erpSellerId from payload in inviteUser and force null', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: 999 // Should be ignored
      };

      (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      await inviteUser({ data, context });
      
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_invited_user', expect.objectContaining({
        _erp_seller_id: null
      }));
    });

    it('should preserve existing erpSellerId in updateUser', async () => {
      const context = { userId: 'admin-1', supabase: {} as any };
      const data = {
        id: 'user-1',
        fullName: 'Updated Name',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: 888, // Trying to change
        active: true
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { erp_seller_id: 123 } // Existing seller ID
            })
          })
        })
      });

      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      await updateUser({ data, context });
      
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_update_user', expect.objectContaining({
        _erp_seller_id: 123 // Preserved from DB, not from payload
      }));
    });
  });
});
