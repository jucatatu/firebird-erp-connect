import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReorderCatalogItems, useUpsertCatalogSetting } from '../use-catalog';
import { supabase } from '@/integrations/supabase/client';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

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
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [{ id: 'A' }, { id: 'C' }, { id: 'B' }],
        error: null,
      } as any);

      const mockOrder2 = vi.fn().mockResolvedValue({
        data: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], // Wrong order
        error: null,
      });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

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
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: '1' }, error: null } as any);
      
      const mockSingle = vi.fn().mockResolvedValue({
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
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

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
