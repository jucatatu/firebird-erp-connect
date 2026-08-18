import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marca o flag must_change_password como false para o usuário logado.
 * Deve ser chamado APÓS o sucesso de supabase.auth.updateUser({ password: newPassword }).
 */
export const completeInitialPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // context.userId vem do requireSupabaseAuth middleware
    const { error } = await supabaseAdmin.rpc("complete_initial_password_change" as any);

    if (error) {
      throw new Error("Falha ao atualizar status do perfil: " + error.message);
    }

    return { success: true };
  });
