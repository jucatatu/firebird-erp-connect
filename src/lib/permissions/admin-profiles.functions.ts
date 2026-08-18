import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";

/**
 * Lista perfis de permissão.
 */
export const listPermissionProfiles = createServerFn({ method: "GET" })
  .handler(async () => {
    await requirePermission("admin.permission_profiles", "view");

    const { data, error } = await supabaseAdmin
      .from("permission_profiles")
      .select(`
        id,
        name,
        description,
        active,
        is_system,
        profiles (id)
      `)
      .order("name", { ascending: true });

    if (error) throw error;

    return data.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      isSystem: p.is_system,
      userCount: (p.profiles as any[])?.length ?? 0
    }));
  });

/**
 * Salva regras de um perfil.
 */
export const saveProfileRules = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    profileId: z.string(),
    rules: z.array(z.object({
      resourceId: z.string(),
      canView: z.boolean(),
      canCreate: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    await requirePermission("admin.permission_profiles", "edit");

    // Verifica se é perfil de sistema (Administrador)
    const { data: profile } = await supabaseAdmin
      .from("permission_profiles")
      .select("is_system")
      .eq("id", data.profileId)
      .single();

    if (profile?.is_system) {
      throw new Error("Não é permitido alterar regras de perfis de sistema.");
    }

    // Upsert das regras
    const { error } = await supabaseAdmin
      .from("permission_profile_rules")
      .upsert(
        data.rules.map(r => ({
          profile_id: data.profileId,
          resource_id: r.resourceId,
          can_view: r.canView,
          can_create: r.canCreate,
          can_edit: r.canEdit,
          can_delete: r.canDelete
        })),
        { onConflict: 'profile_id,resource_id' }
      );

    if (error) throw error;
    return { success: true };
  });
