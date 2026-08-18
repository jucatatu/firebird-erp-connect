import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    permissionProfileId: z.string(),
    companies: z.array(z.number()),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().nullable()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.users",
      action: "create",
      supabase
    });

    // 1. Criar convite no Supabase Auth
    const { data: invite, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (inviteErr) throw new Error("Falha ao enviar convite: " + inviteErr.message);

    const newUserId = invite.user.id;

    try {
      // 2. Configurar perfil e tabelas relacionadas ATOMICAMENTE via RPC
      const { error: setupError } = await supabaseAdmin.rpc("admin_setup_invited_user", {
        _user_id: newUserId,
        _full_name: data.fullName,
        _permission_profile_id: data.permissionProfileId,
        _erp_seller_id: data.erpSellerId as any, // Cast to any because the RPC expect integer (number), and Zod nullable translates to null, which PG handles.
        _company_ids: data.companies,
        _roles: data.roles
      });

      if (setupError) throw setupError;
    } catch (e: any) {
      console.error("[INVITE] Falha na configuração pós-convite. Tentando compensação...", e);
      // Compensação: Remove o usuário convidado se a configuração falhar para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Usuário convidado, mas falha na configuração: ${e.message || 'Erro desconhecido'}`);
    }

    return { success: true };
  });
