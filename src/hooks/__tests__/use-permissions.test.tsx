import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePermissions } from '../use-permissions';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should load permissions and correctly resolve can()', async () => {
    const mockProfile = {
      permission_profile_id: 'prof-123',
      permission_profiles: {
        id: 'prof-123',
        name: 'Admin',
        active: true,
        is_system: true,
      },
    };

    const mockRules = [
      {
        can_view: true,
        can_create: true,
        can_edit: false,
        can_delete: false,
        permission_resources: { key: 'commercial.orders' },
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockProfile, error: null }),
            }),
          }),
        };
      }
      if (table === 'permission_profile_rules') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockRules, error: null }),
          }),
        };
      }
    });

    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.can('commercial.orders', 'view')).toBe(true);
    expect(result.current.can('commercial.orders', 'create')).toBe(true);
    expect(result.current.can('commercial.orders', 'edit')).toBe(false);
    expect(result.current.can('unknown.resource', 'view')).toBe(false);
  });
});
