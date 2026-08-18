import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Altera a senha inicial do usuário e limpa a flag must_change_password.
 * Executado inteiramente server-side para maior segurança.
 */
export const changeInitialPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    newPassword: z.string().min(8).refine(val => val.trim().length >= 8, {
      message: "Senha deve ter pelo menos 8 caracteres (sem contar apenas espaços)"
    }),
    confirmPassword: z.string().min(8)
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"]
  }).parse(data))
  .handler(async ({ data, context }) => {
    // context.userId vem do requireSupabaseAuth middleware
    const userId = context.userId;

    // 1. Verificar se o profile realmente precisa trocar a senha
    const { data: profile, error: profileGetError } = await supabaseAdmin
      .from("profiles")
      .select("id, must_change_password")
      .eq("id", userId)
      .single();

    if (profileGetError) {
      throw new Error("Falha ao validar status do perfil.");
    }

    if (!profile?.must_change_password) {
      throw new Error("Troca de senha não é necessária ou já foi realizada.");
    }

    // 2. Atualizar senha no Supabase Auth via Admin API (server-side)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: data.newPassword }
    );

    if (authError) {
      throw new Error("Falha ao atualizar senha no sistema de autenticação: " + authError.message);
    }

    // 3. Somente após sucesso no Auth, limpar a flag no profile
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId);

    if (profileUpdateError) {
      // Nota: A senha FOI alterada, mas o profile falhou. 
      // O usuário continuará bloqueado pela flag e precisará tentar novamente (usando a nova senha).
      throw new Error("Senha alterada, mas falha ao atualizar status do perfil. Por favor, tente novamente.");
    }

    return { success: true };
  });
