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
    from: vi.fn()
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

  it('should change password successfully and follow the correct order', async () => {
    const userId = 'user-1';
    
    // Mock profile lookup (must_change_password: true)
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: userId, must_change_password: true }, 
          error: null 
        })
      })
    });

    // Mock Profile update
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    });

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: mockSelect, update: mockUpdate };
      }
      return {};
    });

    // Mock Auth update (success)
    (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ error: null });

    const result = await (changeInitialPassword as any)({ 
      data: validData, 
      context: { userId } 
    });
    
    expect(result.success).toBe(true);
    
    // Verificações de Ordem e Chamadas
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(userId, { 
      password: validData.newPassword 
    });
    expect(mockUpdate).toHaveBeenCalledWith({ must_change_password: false });
  });

  it('should NOT call Auth update if profile does not need change', async () => {
    const userId = 'user-1';
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: userId, must_change_password: false }, 
          error: null 
        })
      })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId } 
    })).rejects.toThrow('Troca de senha não é necessária ou já foi realizada.');
    
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('should NOT update profile if Auth update fails', async () => {
    const userId = 'user-1';
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: userId, must_change_password: true }, 
          error: null 
        })
      })
    });
    const mockUpdate = vi.fn();
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect, update: mockUpdate });

    (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ 
      error: { message: 'Auth error' } 
    });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId } 
    })).rejects.toThrow('Falha ao atualizar senha no sistema de autenticação: Auth error');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should return error if Auth succeeds but Profile update fails', async () => {
    const userId = 'user-1';
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: { id: userId, must_change_password: true }, 
          error: null 
        })
      })
    });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Profile update failed' } })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect, update: mockUpdate });
    (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ error: null });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId } 
    })).rejects.toThrow('Senha alterada, mas falha ao atualizar status do perfil.');
    
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should NOT call Auth if profile lookup fails', async () => {
    const userId = 'user-1';
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Lookup error' } 
        })
      })
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: mockSelect });

    await expect((changeInitialPassword as any)({ 
      data: validData, 
      context: { userId } 
    })).rejects.toThrow('Falha ao validar status do perfil.');
    
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
