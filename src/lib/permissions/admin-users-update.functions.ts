import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atualiza um usuário existente.
 */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string(),
    fullName: z.string().min(1),
    permissionProfileId: z.string(),
    companies: z.array(z.number()),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().nullable(),
    active: z.boolean()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId: execUserId } = context;

    await requirePermission({
      userId: execUserId,
      resource: "admin.users",
      action: "edit",
      supabase
    });

    // Se estiver desativando ou removendo role admin ou perfil admin, precisa de admin.users/delete
    // e validação de último admin
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("active, permission_profile_id, permission_profiles(name)")
      .eq("id", data.id)
      .single();
    
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);

    const isTargetAdmin = targetRoles?.some(r => r.role === 'admin') && 
                        (targetProfile?.permission_profiles as any)?.name === 'Administrador';

    const willBeAdmin = data.roles.includes('admin') && 
                       // Precisamos checar o nome do novo perfil selecionado
                       (await supabaseAdmin.from("permission_profiles").select("name").eq("id", data.permissionProfileId).single()).data?.name === 'Administrador';

    const isDeactivating = (targetProfile?.active && !data.active);
    const isLosingAdmin = isTargetAdmin && !willBeAdmin;

    if (isDeactivating || isLosingAdmin) {
      await requirePermission({
        userId: execUserId,
        resource: "admin.users",
        action: "delete",
        supabase
      });

      const { data: adminsCount } = await supabase.rpc("count_active_admins");
      if (isTargetAdmin && (adminsCount || 0) <= 1) {
         const error = new Error("Operação bloqueada: Não é possível deixar o sistema sem administradores ativos.");
         (error as any).code = "LAST_ADMIN_PROTECTION";
         throw error;
      }
    }

    // Sincronização automática Perfil Administrador <=> role admin
    const newProfileName = (await supabaseAdmin.from("permission_profiles").select("name").eq("id", data.permissionProfileId).single()).data?.name;
    const finalRoles = [...data.roles];
    if (newProfileName === 'Administrador' && !finalRoles.includes('admin')) {
      finalRoles.push('admin');
    } else if (newProfileName !== 'Administrador' && finalRoles.includes('admin')) {
      // Se tirou perfil admin mas manteve role admin, ou vice-versa, forçamos consistência
      // Se não for admin no perfil, não pode ser admin no role (conforme plano item 5)
      const idx = finalRoles.indexOf('admin');
      finalRoles.splice(idx, 1);
    }

    // Persistência
    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      active: data.active,
      permission_profile_id: data.permissionProfileId,
      erp_seller_id: data.erpSellerId
    }).eq("id", data.id);

    // Atualiza empresas (Delete & Insert)
    await supabaseAdmin.from("user_company_access").delete().eq("user_id", data.id);
    if (data.companies.length > 0) {
      await supabaseAdmin.from("user_company_access").insert(
        data.companies.map(c => ({ user_id: data.id, company_id: c }))
      );
    }

    // Atualiza roles (Delete & Insert)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    if (finalRoles.length > 0) {
      await supabaseAdmin.from("user_roles").insert(
        finalRoles.map(r => ({ user_id: data.id, role: r }))
      );
    }

    return { success: true };
  });
