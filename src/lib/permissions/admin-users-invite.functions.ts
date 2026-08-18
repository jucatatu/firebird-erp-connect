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
    erpSellerId: z.number().optional()
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
      // 2. Configurar perfil e tabelas relacionadas
      // Nota: Esta etapa não é atômica com o convite Auth
      await supabaseAdmin.from("profiles").upsert({
        id: newUserId,
        full_name: data.fullName,
        active: true,
        permission_profile_id: data.permissionProfileId,
        erp_seller_id: data.erpSellerId ?? null
      });

      if (data.companies.length > 0) {
        await supabaseAdmin.from("user_company_access").insert(
          data.companies.map(c => ({ user_id: newUserId, company_id: c }))
        );
      }

      if (data.roles.length > 0) {
        await supabaseAdmin.from("user_roles").insert(
          data.roles.map(r => ({ user_id: newUserId, role: r }))
        );
      }
    } catch (e) {
      // Compensação: tenta desativar o profile ou remover dados parciais
      console.error("[COMPENSATION] Falha na configuração pós-convite:", e);
      throw new Error("Usuário convidado no Auth, mas falha na configuração de perfis.");
    }

    return { success: true };
  });
