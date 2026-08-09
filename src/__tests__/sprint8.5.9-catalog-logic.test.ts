import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchErpProducts, listErpEquipmentTypes } from '../lib/erp.functions';

// Mock do supabaseAdmin
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockImplementation((col, val) => {
      // Mock de retorno baseado na empresa
      const companyId = val[0];
      const products = [
        { erp_item_id: 1, display_name: 'PILSEN CATALOG', ordem: 1, item_type: 'product', company_ids: [1, 3] },
        { erp_item_id: 2, display_name: 'IPA CATALOG', ordem: 2, item_type: 'product', company_ids: [1] },
        { erp_item_id: 10, display_name: 'EQUIP A', ordem: 1, item_type: 'equipment', company_ids: [1, 3] },
      ];
      
      const filtered = products.filter(p => p.company_ids.includes(companyId));
      return { data: filtered, error: null };
    }),
  },
}));

// Mock do callErp
vi.mock('../lib/erp.server', () => ({
  callErp: vi.fn().mockImplementation(({ path }) => {
    if (path === '/api/v1/products') {
      return {
        ok: true,
        data: {
          products: [
            { id: 1, description: 'CHOPP PILSEN ERP', code: 'P1' },
            { id: 2, description: 'CHOPP IPA ERP', code: 'P2' },
            { id: 3, description: 'OUTRO PRODUTO', code: 'P3' },
          ]
        }
      };
    }
    if (path === '/api/v1/equipment-types') {
      return {
        ok: true,
        data: {
          equipmentTypes: [
            { id: 10, description: 'EQUIPAMENTO A ERP' },
            { id: 20, description: 'EQUIPAMENTO B ERP' },
          ]
        }
      };
    }
  }),
}));

describe('Sprint 8.5.9 - Listagem Automática e Ordenada', () => {
  it('deve listar apenas produtos habilitados para a empresa e respeitar a ordem', async () => {
    const res = await searchErpProducts({ 
      data: { q: '', companyId: 1, isAdminSearch: false } 
    });

    expect(res.ok).toBe(true);
    if (!res.data) throw new Error('res.data is null');
    expect(res.data.products).toHaveLength(2);
    // Ordem 1: PILSEN, Ordem 2: IPA
    expect(res.data.products[0].id).toBe(1);
    expect(res.data.products[0].description).toBe('PILSEN CATALOG');
    expect(res.data.products[1].id).toBe(2);
    expect(res.data.products[1].description).toBe('IPA CATALOG');
  });

  it('deve filtrar produtos por empresa (Grott não tem IPA)', async () => {
    const res = await searchErpProducts({ 
      data: { q: '', companyId: 3, isAdminSearch: false } 
    });

    expect(res.ok).toBe(true);
    if (!res.data) throw new Error('res.data is null');
    expect(res.data.products).toHaveLength(1);
    expect(res.data.products[0].id).toBe(1);
  });

  it('equipamentos devem seguir a mesma lógica de habilitação e ordem', async () => {
    const res = await listErpEquipmentTypes({ 
      data: { q: '', companyId: 1, isAdminSearch: false } 
    });

    expect(res.ok).toBe(true);
    if (!res.data) throw new Error('res.data is null');
    expect(res.data.equipmentTypes).toHaveLength(1);
    expect(res.data.equipmentTypes[0].id).toBe(10);
    expect(res.data.equipmentTypes[0].description).toBe('EQUIP A');
  });
});
