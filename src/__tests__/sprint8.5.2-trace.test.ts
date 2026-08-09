import { describe, it, expect, vi } from 'vitest';
import { searchErpClients } from '../lib/erp-orders.functions';

// Mock erp.server.ts
vi.mock('../lib/erp.server', () => ({
  callErp: vi.fn(async ({ method, path, query }) => {
    // Simulação do comportamento da ERP API v1.8.0
    if (path === '/api/v1/clients') {
      return {
        ok: true,
        status: 200,
        data: {
          clients: [
            { id: 100, name: "ROMEU TESTE", companyId: 1 },
            { id: 200, name: "ADEMIR OUTRO", companyId: 1 }
          ],
          nextCursor: null
        }
      };
    }
    return { ok: false, status: 404 };
  })
}));

describe('Sprint 8.5.2 - Customer Search Trace', () => {
  it('should pass correct parameters to ERP API', async () => {
    const { callErp } = await import('../lib/erp.server');
    
    // Teste A: Graal + Romeu
    await searchErpClients({ data: { q: "Romeu", companyId: 1 } });
    
    expect(callErp).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/v1/clients',
      query: expect.objectContaining({
        q: 'Romeu',
        companyId: '1'
      })
    }));
  });
});
