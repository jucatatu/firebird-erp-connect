import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mocks
vi.mock('@tanstack/react-start', () => {
  const createServerFn = vi.fn().mockImplementation((options) => {
    const builder: any = {
      middleware: vi.fn().mockImplementation((m) => {
        options.middleware = m;
        return builder;
      }),
      inputValidator: vi.fn().mockImplementation((v) => {
        options.inputValidator = v;
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
    auth: {
      admin: {
        updateUserById: vi.fn(),
      }
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      }))
    }))
  }
}));

vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: vi.fn()
}));

import { changeInitialPassword } from '../password-change.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

describe('Initial Password Change Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validData = {
    newPassword: 'newpassword123',
    confirmPassword: 'newpassword123'
  };

  it('should change password successfully', async () => {
    // Mock profile check
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: 'user-1', must_change_password: true }, 
          error: null 
        })
      })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect, update: vi.fn() });

    // Mock Auth update
    (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ error: null });

    // Mock Profile update
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect, update: mockUpdate });

    const result = await (changeInitialPassword as any)({ 
      data: validData, 
      context: { userId: 'user-1' } 
    });
    
    expect(result.success).toBe(true);
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { 
      password: validData.newPassword 
    });
    expect(mockUpdate).toHaveBeenCalledWith({ must_change_password: false });
  });

  it('should throw error if profile does not need change', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: 'user-1', must_change_password: false }, 
          error: null 
        })
      })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId: 'user-1' } 
    })).rejects.toThrow('Troca de senha não é necessária ou já foi realizada.');
    
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('should throw error if auth update fails', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: 'user-1', must_change_password: true }, 
          error: null 
        })
      })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect });

    (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ 
      error: { message: 'Auth error' } 
    });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId: 'user-1' } 
    })).rejects.toThrow('Falha ao atualizar senha no sistema de autenticação: Auth error');
  });
});
