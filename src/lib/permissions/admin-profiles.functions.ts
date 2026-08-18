import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista perfis de permissão.
 */
export const listPermissionProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.permission_profiles",
      action: "view",
      supabase
    });

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
  .middleware([requireSupabaseAuth])
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
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.permission_profiles",
      action: "edit",
      supabase
    });

    const { data: profile } = await supabaseAdmin
      .from("permission_profiles")
      .select("is_system")
      .eq("id", data.profileId)
      .single();

    if (profile?.is_system) {
      const error = new Error("SYSTEM_PROFILE_PROTECTED: Não é permitido alterar regras de um perfil de sistema.");
      (error as any).code = "SYSTEM_PROFILE_PROTECTED";
      throw error;
    }

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

