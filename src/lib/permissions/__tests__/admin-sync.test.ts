import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks MUST be defined before imports
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

vi.mock('../permissions.server', () => ({
  requirePermission: vi.fn(() => Promise.resolve(true))
}));

vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: vi.fn((ctx) => ctx)
}));

// Mock @tanstack/react-start to bypass AsyncLocalStorage issues in tests
vi.mock('@tanstack/react-start', async () => {
  const actual = await vi.importActual('@tanstack/react-start');
  return {
    ...actual,
    createServerFn: vi.fn().mockImplementation(() => {
      const fn: any = (handler: any) => handler;
      fn.handler = (handler: any) => handler;
      fn.middleware = () => fn;
      fn.inputValidator = () => fn;
      return fn;
    }),
  };
});

import { inviteUser } from '../admin-users-invite.functions';
import { updateUser } from '../admin-users-update.functions';
import { updatePermissionProfile } from '../admin-profiles-crud.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const mockContext = { 
  userId: 'admin-1', 
  supabase: {} as any 
};

describe('Admin Hardening & Sync Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Company Allowlist', () => {
    it('should reject invalid company IDs in inviteUser (Zod)', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1, 2], // 2 is invalid
        roles: ['vendedor'] as any,
        erpSellerId: null
      };

      await expect(inviteUser({ data, context: mockContext } as any)).rejects.toThrow();
    });

    it('should accept valid company IDs [1, 3] in inviteUser', async () => {
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

      const result = await inviteUser({ data, context: mockContext } as any);
      expect(result.success).toBe(true);
    });
  });

  describe('System Profile Protection', () => {
    it('should reject renaming a system profile', async () => {
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

      await expect(updatePermissionProfile({ data, context: mockContext } as any)).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
    });

    it('should reject deactivating a system profile', async () => {
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

      await expect(updatePermissionProfile({ data, context: mockContext } as any)).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
    });
  });

  describe('ERP Seller Immutability', () => {
    it('should ignore erpSellerId from payload in inviteUser and force null', async () => {
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

      await inviteUser({ data, context: mockContext } as any);
      
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_invited_user', expect.objectContaining({
        _erp_seller_id: null
      }));
    });

    it('should preserve existing erpSellerId in updateUser', async () => {
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

      await updateUser({ data, context: mockContext } as any);
      
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_update_user', expect.objectContaining({
        _erp_seller_id: 123 // Preserved from DB, not from payload
      }));
    });
  });

  describe('Profile Sync & Error Handling', () => {
    it('should handle INVALID_PERMISSION_PROFILE from RPC', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Test',
        permissionProfileId: 'invalid-id',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null,
        active: true
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { erp_seller_id: null } })
          })
        })
      });

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { message: 'INVALID_PERMISSION_PROFILE: Perfil de permissão inexistente.' } 
      });

      await expect(updateUser({ data, context: mockContext } as any)).rejects.toThrow('Perfil de permissão inexistente');
    });

    it('should handle LAST_ADMIN_PROTECTION from RPC', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Test',
        permissionProfileId: 'vendedor-profile',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null,
        active: true
      };

      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { erp_seller_id: null } })
          })
        })
      });

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { message: 'LAST_ADMIN_PROTECTION: Não é permitido desativar ou remover privilégios do último administrador ativo.' } 
      });

      await expect(updateUser({ data, context: mockContext } as any)).rejects.toThrow('Não é permitido desativar ou remover privilégios do último administrador ativo');
    });
  });
});
