import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mocks
vi.mock('@tanstack/react-start', () => {
  const createServerFn = vi.fn().mockImplementation((options) => {
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
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        inviteUserByEmail: vi.fn(),
      }
    },
    rpc: vi.fn(),
    from: vi.fn()
  }
}));

vi.mock('../permissions.server', () => ({
  requirePermission: vi.fn(() => Promise.resolve(true))
}));

vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: vi.fn()
}));

vi.mock('@/lib/erp-sellers.server', () => ({
  validateErpSellerForCompaniesServer: vi.fn(),
  getErpSellerDetailServer: vi.fn(),
}));

vi.mock('@/lib/erp-sellers.functions', () => ({
  validateErpSellerForCompanies: vi.fn(),
  getErpSellerDetail: vi.fn(),
}));

import { createAdminUser } from '../admin-users-create.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { validateErpSellerForCompaniesServer } from '@/lib/erp-sellers.server';
import { validateErpSellerForCompanies } from '@/lib/erp-sellers.functions';

const mockContext = { 
  userId: 'admin-1', 
  supabase: {} as any 
};

describe('Admin User Creation Flow (Direct Creation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default profile mock (active)
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'profile-1', active: true }, 
            error: null 
          })
        })
      })
    });
    (supabaseAdmin.from as any).mockImplementation(mockFrom);
  });

  const validData = {
    email: 'new@example.com',
    fullName: 'New User',
    temporaryPassword: 'password123',
    confirmPassword: 'password123',
    permissionProfileId: 'profile-1',
    companies: [1],
    roles: ['vendedor'] as any,
    erpSellerId: null
  };

  it('should use createUser and NOT inviteUserByEmail', async () => {
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    const result = await (createAdminUser as any)({ data: validData, context: mockContext });
    
    expect(result.success).toBe(true);
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: validData.email,
      password: validData.temporaryPassword,
      email_confirm: true
    }));
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_created_user', expect.anything());
  });

  it('should block creation if profile is inactive', async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'profile-1', active: false }, 
            error: null 
          })
        })
      })
    });

    await expect((createAdminUser as any)({ data: validData, context: mockContext }))
      .rejects.toThrow('Não é permitido atribuir um perfil inativo.');
    
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('should allow erpSellerId null', async () => {
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    await (createAdminUser as any)({ data: validData, context: mockContext });
    expect(validateErpSellerForCompanies).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
  });

  it('should validate ERP Seller before createUser', async () => {
    const data = { ...validData, erpSellerId: 123 };
    (vi.mocked(validateErpSellerForCompanies) as any).mockResolvedValue({ ok: true });
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    await (createAdminUser as any)({ data, context: mockContext });
    
    expect(validateErpSellerForCompanies).toHaveBeenCalledWith(123, [1]);
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
  });

  it('should block creation if Seller mismatch occurs before Auth', async () => {
    const data = { ...validData, erpSellerId: 123 };
    (vi.mocked(validateErpSellerForCompanies) as any).mockResolvedValue({ 
      ok: false, 
      error: { code: 'SELLER_COMPANY_MISMATCH', message: 'Mismatch' } 
    });

    await expect((createAdminUser as any)({ data, context: mockContext }))
      .rejects.toThrow('Mismatch');
    
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('should block creation if ERP is offline', async () => {
    const data = { ...validData, erpSellerId: 123 };
    (vi.mocked(validateErpSellerForCompanies) as any).mockResolvedValue({ 
      ok: false, 
      error: { code: 'ERP_UNAVAILABLE', message: 'Offline' } 
    });

    await expect((createAdminUser as any)({ data, context: mockContext }))
      .rejects.toThrow('Offline');
    
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('should handle duplicate email from Auth', async () => {
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ 
      data: { user: null }, 
      error: { message: 'User already registered' } 
    });

    await expect((createAdminUser as any)({ data: validData, context: mockContext }))
      .rejects.toThrow('Já existe um usuário cadastrado com este e-mail.');
    
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('should compensate (delete user) if setup RPC fails', async () => {
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ 
      error: { hint: 'INVALID_PERMISSION_PROFILE', message: 'Fail' } 
    });
    (supabaseAdmin.auth.admin.deleteUser as any).mockResolvedValue({ error: null });

    await expect((createAdminUser as any)({ data: validData, context: mockContext }))
      .rejects.toThrow('Perfil de permissão inexistente ou inativo.');
    
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('new-user');
  });

  it('should handle profiles_pkey idempotently (via RPC)', async () => {
    (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: { user: { id: 'existing-id' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    await (createAdminUser as any)({ data: validData, context: mockContext });
    
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_setup_created_user', expect.objectContaining({
      _user_id: 'existing-id'
    }));
  });
});
