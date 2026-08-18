import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista todos os usuários com dados administrativos.
 */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    await requirePermission({
      userId,
      resource: "admin.users",
      action: "view",
      supabase
    });

    const { data: profiles, error: pError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        active,
        permission_profile_id,
        erp_seller_id,
        permission_profiles (name)
      `)
      .order("full_name", { ascending: true });

    if (pError) throw new Error("Falha ao buscar perfis");

    const { data: authUsers, error: aError } = await supabaseAdmin.auth.admin.listUsers();
    if (aError) throw new Error("Falha ao buscar usuários auth");

    const { data: companyAccess, error: cError } = await supabaseAdmin
      .from("user_company_access")
      .select("user_id, company_id");
    
    const { data: legacyRoles, error: rError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    return profiles.map(p => {
      const authUser = authUsers.users.find(u => u.id === p.id);
      return {
        id: p.id,
        email: authUser?.email ?? "N/A",
        fullName: p.full_name,
        active: p.active,
        permissionProfileId: p.permission_profile_id,
        permissionProfileName: (p.permission_profiles as any)?.name,
        erpSellerId: p.erp_seller_id,
        companies: companyAccess?.filter(ca => ca.user_id === p.id).map(ca => ca.company_id) ?? [],
        roles: legacyRoles?.filter(lr => lr.user_id === p.id).map(lr => lr.role) ?? []
      };
    });
  });

/**
 * Ativa/Desativa um usuário.
 */
export const setUserActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ targetUserId: z.string(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId: adminId } = context;

    // Se estiver tentando desativar, precisa de admin.users/delete
    const action = data.active ? "edit" : "delete";

    await requirePermission({
      userId: adminId,
      resource: "admin.users",
      action,
      supabase
    });

    if (data.active === false) {
      // Proteção real do último admin
      const { data: adminsCount, error: countErr } = await supabase.rpc("count_active_admins");
      if (countErr) throw new Error("Falha ao verificar administradores ativos");

      // Se for o alvo for um dos admins e só tiver 1 ativo
      const { data: targetIsAdmin } = await supabase.rpc("has_role", { 
        _user_id: data.targetUserId, 
        _role: "admin" 
      });

      if (targetIsAdmin && adminsCount <= 1) {
        const error = new Error("Não é possível desativar o último administrador ativo do sistema.");
        (error as any).code = "LAST_ADMIN_PROTECTION";
        throw error;
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.targetUserId);

    if (error) throw new Error("Falha ao atualizar status do usuário");

    return { success: true };
  });


