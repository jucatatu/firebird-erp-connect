import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";

/**
 * Lista todos os usuários com dados administrativos.
 */
export const listAdminUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { userId } = await requirePermission("admin.users", "view");

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

    // Buscamos e-mails via Auth API (requer admin client)
    const { data: authUsers, error: aError } = await supabaseAdmin.auth.admin.listUsers();
    if (aError) throw new Error("Falha ao buscar usuários auth");

    // Buscamos acessos a empresas
    const { data: companyAccess, error: cError } = await supabaseAdmin
      .from("user_company_access")
      .select("user_id, company_id");
    
    // Buscamos roles legadas
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
  .inputValidator((data) => z.object({ targetUserId: z.string(), active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { userId: adminId } = await requirePermission("admin.users", "edit");

    // Proteção do último admin (lógica simplificada: não desativar a si mesmo se for admin)
    // Uma implementação robusta contaria admins ativos no banco.
    if (data.targetUserId === adminId && data.active === false) {
      throw new Error("LAST_ADMIN_PROTECTION: Você não pode desativar seu próprio acesso administrativo.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.targetUserId);

    if (error) throw new Error("Falha ao atualizar status do usuário");

    return { success: true };
  });
