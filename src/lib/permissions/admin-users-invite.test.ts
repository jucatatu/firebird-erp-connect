import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testableInviteUser } from './admin-users-invite.functions';
import * as sellersFunctions from '@/lib/erp-sellers.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import * as permissionsServer from './permissions.server';

vi.mock('@/lib/erp-sellers.functions', () => ({
  validateErpSellerForCompanies: vi.fn(),
}));

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    rpc: vi.fn(),
  },
}));

vi.mock('./permissions.server', () => ({
  requirePermission: vi.fn(),
}));

describe('admin-users-invite.functions - Ordem de Validação', () => {
  const mockContext = {
    supabase: {},
    userId: 'admin-123',
  };

  const mockData = {
    email: 'test@example.com',
    fullName: 'Test User',
    permissionProfileId: 'profile-123',
    companies: [1],
    roles: ['vendedor'],
    erpSellerId: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (permissionsServer.requirePermission as any).mockResolvedValue(true);
  });

  it('deve falhar e NÃO enviar convite se o vendedor for inválido', async () => {
    (sellersFunctions.validateErpSellerForCompanies as any).mockResolvedValue({
      ok: false,
      error: { code: 'SELLER_NOT_FOUND', message: 'Vendedor não existe' },
    });

    await expect(testableInviteUser(mockData, mockContext)).rejects.toThrow('Vendedor não existe');

    expect(sellersFunctions.validateErpSellerForCompanies).toHaveBeenCalledWith(50, [1]);
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('deve falhar e NÃO enviar convite se o ERP estiver indisponível', async () => {
    (sellersFunctions.validateErpSellerForCompanies as any).mockResolvedValue({
      ok: false,
      error: { code: 'ERP_UNAVAILABLE', message: 'ERP offline' },
    });

    await expect(testableInviteUser(mockData, mockContext)).rejects.toThrow('ERP offline');

    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('deve enviar convite somente após validação de sucesso do vendedor', async () => {
    (sellersFunctions.validateErpSellerForCompanies as any).mockResolvedValue({ ok: true });
    (supabaseAdmin.auth.admin.inviteUserByEmail as any).mockResolvedValue({ data: { user: { id: 'new-user-456' } } });
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    const result = await testableInviteUser(mockData, mockContext);

    expect(result.success).toBe(true);
    expect(sellersFunctions.validateErpSellerForCompanies).toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(mockData.email);
  });
});
