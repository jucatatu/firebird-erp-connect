import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateErpOrder } from '../../erp-orders.functions';

// Mock do erp.server.ts
vi.mock('../../erp.server', () => ({
  callErp: vi.fn(async (opts) => {
    return { ok: true, status: 201, data: { orderId: 123, orderNumber: 456 }, error: null };
  })
}));

// Mock do supabase client.server
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } }, error: null }))
    },
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: { erp_seller_id: 4 }, error: null }))
        };
      }
      if (table === 'user_company_access') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({ data: [{ company_id: 1 }], error: null }))
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
    })
  }
}));

describe('handleCreateErpOrder - Sprint 8.2 (Empresa)', () => {
  const mockPayload = {
    companyId: 1,
    clientId: 1465,
    sellerId: 999,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: new Date().toISOString(),
    returnEquipment: false,
    items: [{ productId: 1, quantity: 1 }],
    equipments: []
  };
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TESTE 1: Usuário somente Graal [1], solicita 1 -> Permitido', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 1 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(true);
  });

  it('TESTE 2: Usuário somente Graal [1], solicita 3 -> 403 COMPANY_NOT_ALLOWED', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { callErp } = await import('../../erp.server');
    
    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 3 }, 'key-1', mockUserId, supabaseAdmin);
    
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('COMPANY_NOT_ALLOWED');
    expect(callErp).not.toHaveBeenCalled();
  });

  it('TESTE 3: Usuário somente Grott [3], solicita 3 -> Permitido', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'user_company_access') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [{ company_id: 3 }], error: null })) } as any;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: { erp_seller_id: 4 }, error: null })) } as any;
      }
      return {} as any;
    });

    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 3 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(true);
  });

  it('TESTE 4: Usuário somente Grott [3], solicita 1 -> 403 COMPANY_NOT_ALLOWED', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { callErp } = await import('../../erp.server');
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'user_company_access') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [{ company_id: 3 }], error: null })) } as any;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() } as any;
    });

    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 1 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('COMPANY_NOT_ALLOWED');
    expect(callErp).not.toHaveBeenCalled();
  });

  it('TESTE 5: Usuário multimarca [1,3], solicita 1 -> Permitido', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'user_company_access') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [{ company_id: 1 }, { company_id: 3 }], error: null })) } as any;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: { erp_seller_id: 4 }, error: null })) } as any;
      }
      return {} as any;
    });

    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 1 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(true);
  });

  it('TESTE 6: Usuário multimarca [1,3], solicita 3 -> Permitido', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'user_company_access') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [{ company_id: 1 }, { company_id: 3 }], error: null })) } as any;
      }
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: { erp_seller_id: 4 }, error: null })) } as any;
      }
      return {} as any;
    });

    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 3 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(true);
  });

  it('TESTE 7: companyId inválido (99) -> Rejeitado antes do ERP', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { callErp } = await import('../../erp.server');
    const result = await handleCreateErpOrder({ ...mockPayload, companyId: 99 }, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_COMPANY');
    expect(callErp).not.toHaveBeenCalled();
  });

  it('TESTE 8: Usuário sem empresa associada -> Rejeitado antes do ERP', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { callErp } = await import('../../erp.server');
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'user_company_access') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [], error: null })) } as any;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() } as any;
    });

    const result = await handleCreateErpOrder(mockPayload, 'key-1', mockUserId, supabaseAdmin);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NO_COMPANY_ACCESS');
    expect(callErp).not.toHaveBeenCalled();
  });
});