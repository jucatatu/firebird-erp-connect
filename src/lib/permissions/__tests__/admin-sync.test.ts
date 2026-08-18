import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mocks must be defined before any imports
// We need to mock createServerFn so it returns an object with the chainable methods
vi.mock('@tanstack/react-start', () => {
  const createServerFn = vi.fn().mockImplementation((options) => {
    // The initial call returns an object that has middleware, inputValidator, and handler
    const builder: any = {
      middleware: vi.fn().mockImplementation((m) => {
        options.middleware = m;
        return builder;
      }),
      inputValidator: vi.fn().mockImplementation((v) => {
        options.inputValidator = v;
        return builder;
      }),
      handler: vi.fn().mockImplementation((h) => {
        options.handler = h;
        // The final handler call returns the actual function that can be executed
        const execFn: any = async (input: any) => options.handler(input);
        return execFn;
      })
    };
    return builder;
  });
  return { createServerFn };
});

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
  requireSupabaseAuth: vi.fn()
}));

vi.mock('@/lib/erp-sellers.functions', () => ({
  validateErpSellerForCompanies: vi.fn(),
  getErpSellerDetail: vi.fn(),
  searchErpSellers: vi.fn(),
}));

// 2. Now import the actual functions (which will use the mocks)
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

      const result = await (inviteUser as any)({ data, context: mockContext });
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

      await expect((updatePermissionProfile as any)({ data, context: mockContext })).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
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

      await expect((updatePermissionProfile as any)({ data, context: mockContext })).rejects.toThrow('SYSTEM_PROFILE_PROTECTED');
    });
  });

  describe('ERP Seller Rules', () => {
    it('should allow erpSellerId null in inviteUser', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null
      };

      (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      const result = await (inviteUser as any)({ data, context: mockContext });
      expect(result.success).toBe(true);
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_invited_user', expect.objectContaining({
        _erp_seller_id: null
      }));
    });

    it('should allow valid erpSellerId in inviteUser', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: 123
      };

      const sellersFuncs = await import('@/lib/erp-sellers.functions');
      vi.mocked(sellersFuncs.validateErpSellerForCompanies).mockResolvedValue({
        ok: true,
        seller: { id: 123, companyId: 1, name: 'Seller', nickname: null } as any
      });

      (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      const result = await (inviteUser as any)({ data, context: mockContext });
      expect(result.success).toBe(true);
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_invited_user', expect.objectContaining({
        _erp_seller_id: 123
      }));
    });

    it('should reject invalid erpSellerId (mismatch) in inviteUser', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [3], // Only Grott
        roles: ['vendedor'] as any,
        erpSellerId: 123 // Graal seller
      };

      const sellersFuncs = await import('@/lib/erp-sellers.functions');
      vi.mocked(sellersFuncs.validateErpSellerForCompanies).mockResolvedValue({
        ok: false,
        error: { code: 'SELLER_COMPANY_MISMATCH', message: 'empresa que não está habilitada' }
      });

      await expect((inviteUser as any)({ data, context: mockContext })).rejects.toThrow('empresa que não está habilitada');
      expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    });

    it('should reject erpSellerId if ERP is unavailable in inviteUser', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: 123
      };

      const sellersFuncs = await import('@/lib/erp-sellers.functions');
      vi.mocked(sellersFuncs.validateErpSellerForCompanies).mockResolvedValue({
        ok: false,
        error: { code: 'ERP_UNAVAILABLE', message: 'Não foi possível consultar os vendedores' }
      });

      await expect((inviteUser as any)({ data, context: mockContext })).rejects.toThrow('Não foi possível consultar os vendedores');
      expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    });

    it('should allow updating user with valid erpSellerId', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Updated Name',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: 456,
        active: true
      };

      const sellersFuncs = await import('@/lib/erp-sellers.functions');
      vi.mocked(sellersFuncs.validateErpSellerForCompanies).mockResolvedValue({
        ok: true,
        seller: { id: 456, companyId: 1, name: 'Seller', nickname: null } as any
      });

      (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

      await (updateUser as any)({ data, context: mockContext });
      
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_update_user', expect.objectContaining({
        _erp_seller_id: 456
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

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { hint: 'INVALID_PERMISSION_PROFILE', message: 'Perfil de permissão inexistente.' } 
      });

      await expect((updateUser as any)({ data, context: mockContext })).rejects.toThrow('Perfil de permissão inexistente');
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

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { hint: 'LAST_ADMIN_PROTECTION', message: 'Não é permitido desativar...' } 
      });

      const promise = (updateUser as any)({ data, context: mockContext });
      await expect(promise).rejects.toThrow('Não é possível deixar o sistema sem administradores ativos');
      try {
        await promise;
      } catch (e: any) {
        expect(e.code).toBe('LAST_ADMIN_PROTECTION');
      }
    });

    it('should handle INVALID_COMPANY_ACCESS from RPC', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Test',
        permissionProfileId: 'vendedor-profile',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null,
        active: true
      };

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { hint: 'INVALID_COMPANY_ACCESS', message: 'Acesso inválido...' } 
      });

      const promise = (updateUser as any)({ data, context: mockContext });
      await expect(promise).rejects.toThrow('Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas');
      try {
        await promise;
      } catch (e: any) {
        expect(e.code).toBe('INVALID_COMPANY_ACCESS');
      }
    });

    it('should prioritize hint over P0001 code for LAST_ADMIN_PROTECTION', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Test',
        permissionProfileId: 'vendedor-profile',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null,
        active: false
      };

      // Simula o cenário onde o PostgreSQL retorna code genérico E hint específico
      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { code: 'P0001', hint: 'LAST_ADMIN_PROTECTION', message: 'Raise exception error' } 
      });

      const promise = (updateUser as any)({ data, context: mockContext });
      await expect(promise).rejects.toThrow('Não é possível deixar o sistema sem administradores ativos');
      try {
        await promise;
      } catch (e: any) {
        expect(e.code).toBe('LAST_ADMIN_PROTECTION');
      }
    });

    it('should prioritize hint over P0001 code for INVALID_COMPANY_ACCESS in inviteUser', async () => {
      const data = {
        email: 'test@example.com',
        fullName: 'Test User',
        permissionProfileId: 'profile-1',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null
      };

      (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
      (supabaseAdmin.auth.admin.deleteUser as any).mockResolvedValue({ error: null });
      
      // Simula falha na RPC com code + hint
      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { code: 'P0001', hint: 'INVALID_COMPANY_ACCESS', message: 'Invalid companies' } 
      });

      const promise = (inviteUser as any)({ data, context: mockContext });
      await expect(promise).rejects.toThrow('Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas');
      
      // Verifica compensação do Auth
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('new-user');
    });

    it('should prioritize hint over P0001 code for INVALID_PERMISSION_PROFILE', async () => {
      const data = {
        id: 'user-1',
        fullName: 'Test',
        permissionProfileId: 'invalid-id',
        companies: [1],
        roles: ['vendedor'] as any,
        erpSellerId: null,
        active: true
      };

      (supabaseAdmin.rpc as any).mockResolvedValue({ 
        error: { code: 'P0001', hint: 'INVALID_PERMISSION_PROFILE', message: 'Profile not found' } 
      });

      const promise = (updateUser as any)({ data, context: mockContext });
      await expect(promise).rejects.toThrow('Perfil de permissão inexistente ou inativo');
      try {
        await promise;
      } catch (e: any) {
        expect(e.code).toBe('INVALID_PERMISSION_PROFILE');
      }
    });
  });
});