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
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(async () => ({ data: [{ role: 'vendedor' }], error: null }))
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
    })
  }
}));

describe('createErpOrder Server Function', () => {
  const mockPayload = {
    companyId: 1 as const,
    clientId: 1465,
    sellerId: 999, // Deve ser ignorado pelo real do banco
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: new Date().toISOString(),
    returnEquipment: false,
    items: [{ productId: 1, quantity: 1 }],
    equipments: []
  };

  it('deve resolver o sellerId real do banco e ignorar o do payload', async () => {
    const { callErp } = await import('../../erp.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await handleCreateErpOrder(mockPayload, 'key-1', supabaseAdmin);
    
    expect(result.ok).toBe(true);
    // Verifica se o sellerId enviado ao callErp foi 4 (do mock do profile)
    expect(vi.mocked(callErp)).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        sellerId: 4
      }),
      headers: { "Idempotency-Key": "key-1" }
    }));
  });

  it('deve falhar se o vendedor não estiver mapeado', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    vi.mocked(supabaseAdmin.from).mockImplementationOnce((table) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: null, error: { message: 'Not found' } }))
      };
    });

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await handleCreateErpOrder(mockPayload, undefined, supabaseAdmin);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('SELLER_NOT_MAPPED');
  });
});
