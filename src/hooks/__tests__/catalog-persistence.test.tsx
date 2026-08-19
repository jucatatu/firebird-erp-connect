import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReorderCatalogItems, useUpsertCatalogSetting } from '../use-catalog';
import { supabase } from '@/integrations/supabase/client';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase complex chain
const createMockSupabase = () => {
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();

  const chain = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
  };

  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockOrder.mockReturnValue(chain);
  
  return { chain, mockSelect, mockEq, mockOrder, mockSingle };
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('Catalog Persistence Roundtrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('useReorderCatalogItems', () => {
    it('should throw error if RPC returned order is different from requested', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [{ id: 'A' }, { id: 'B' }],
        error: null,
      } as any);

      const { result } = renderHook(() => useReorderCatalogItems(), { wrapper });

      await expect(
        result.current.mutateAsync({
          itemType: 'product',
          orderedIds: ['A', 'C', 'B'],
          expectedVersions: [1, 1, 1],
        })
      ).rejects.toThrow('catalog_reorder_persistence_mismatch');
    });

    it('should throw error if SELECT REAL returns different order', async () => {
      const { chain, mockOrder } = createMockSupabase();
      
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [{ id: 'A' }, { id: 'C' }, { id: 'B' }],
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue(chain as any);
      
      // Final call in chain
      mockOrder.mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], // Wrong order
          error: null,
        })
      } as any);

      const { result } = renderHook(() => useReorderCatalogItems(), { wrapper });

      await expect(
        result.current.mutateAsync({
          itemType: 'product',
          orderedIds: ['A', 'C', 'B'],
          expectedVersions: [1, 1, 1],
        })
      ).rejects.toThrow('catalog_reorder_roundtrip_mismatch');
    });
  });

  describe('useUpsertCatalogSetting', () => {
    it('should throw error if SELECT values mismatch requested enabled=true', async () => {
      const { chain, mockSingle } = createMockSupabase();
      
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: '1' }, error: null } as any);
      vi.mocked(supabase.from).mockReturnValue(chain as any);
      
      mockSingle.mockResolvedValueOnce({
        data: { 
          enabled: false, // Mismatch!
          company_ids: [1, 3],
          display_name: 'Test',
          default_quantity: 1,
          quantity_step: 1,
          logistics_type: 'packaged',
          requires_pickup: null,
          item_type: 'product'
        },
        error: null
      });

      const { result } = renderHook(() => useUpsertCatalogSetting(), { wrapper });

      await expect(
        result.current.mutateAsync({
          itemType: 'product',
          erpItemId: 123,
          erpDescriptionSnapshot: 'Desc',
          enabled: true,
          companyIds: [1, 3],
          displayName: 'Test',
          sortOrder: null,
          defaultQuantity: 1,
          quantityStep: 1,
          logisticsType: 'packaged',
          requiresPickup: null,
          expectedVersion: null
        })
      ).rejects.toThrow('catalog_setting_persistence_mismatch');
    });
  });
});
