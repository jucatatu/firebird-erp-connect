import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mocks
vi.mock('@tanstack/react-start', () => {
  const createServerFn = vi.fn().mockImplementation((options) => {
    const builder: any = {
      middleware: vi.fn().mockImplementation((m) => {
        options.middleware = m;
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
    rpc: vi.fn(),
  }
}));

vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: vi.fn()
}));

import { completeInitialPasswordChange } from '../password-change.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

describe('Initial Password Change Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call complete_initial_password_change RPC', async () => {
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: null });

    const result = await (completeInitialPasswordChange as any)({ context: { userId: 'user-1' } });
    
    expect(result.success).toBe(true);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('complete_initial_password_change');
  });

  it('should throw error if RPC fails', async () => {
    (supabaseAdmin.rpc as any).mockResolvedValue({ error: { message: 'Database error' } });

    await expect((completeInitialPasswordChange as any)({ context: { userId: 'user-1' } }))
      .rejects.toThrow('Falha ao atualizar status do perfil: Database error');
  });
});
