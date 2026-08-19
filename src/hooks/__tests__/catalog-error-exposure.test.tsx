import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReorderCatalogItems } from '../use-catalog';
import { supabase } from '@/integrations/supabase/client';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { formatSupabaseError } from '@/utils/error-formatter';

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

describe('Catalog Persistence UI Error Exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should expose real Supabase error fields (code, message, details, hint)', async () => {
    const mockError = {
      code: '42501',
      message: 'permission denied for function admin_reorder_catalog_items',
      details: 'User does not have execute permission',
      hint: 'Check RLS and grants',
    };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: mockError,
    } as any);

    const { result } = renderHook(() => useReorderCatalogItems(), { wrapper });

    const promise = result.current.mutateAsync({
      itemType: 'product',
      orderedIds: ['A'],
      expectedVersions: [1],
    });

    await expect(promise).rejects.toThrow();
    
    try {
      await promise;
    } catch (e: any) {
      const formatted = formatSupabaseError(mockError);
      expect(e.message).toBe(formatted);
      expect(e.message).toContain('[42501]');
      expect(e.message).toContain('permission denied');
      expect(e.message).toContain('Detalhe: User does not have execute permission');
      expect(e.message).toContain('Hint: Check RLS and grants');
    }
  });

  it('should translate catalog_reorder_conflict with clear code', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'catalog_reorder_conflict' },
    } as any);

    const { result } = renderHook(() => useReorderCatalogItems(), { wrapper });

    try {
      await result.current.mutateAsync({
        itemType: 'product',
        orderedIds: ['A'],
        expectedVersions: [1],
      });
    } catch (e: any) {
      expect(e.message).toContain('Conflito ao salvar a ordem');
      expect(e.message).toContain('catalog_reorder_conflict');
    }
  });
});
