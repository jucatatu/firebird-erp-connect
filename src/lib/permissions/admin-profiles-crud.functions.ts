import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cria um novo perfil de permissão.
 */
export const createPermissionProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    name: z.string().min(1),
    description: z.string().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.permission_profiles",
      action: "create",
      supabase
    });

    const { data: newProfile, error } = await supabaseAdmin
      .from("permission_profiles")
      .insert({
        name: data.name,
        description: data.description ?? null,
        active: true,
        is_system: false
      })
      .select()
      .single();

    if (error) throw error;
    return newProfile;
  });

/**
 * Atualiza dados básicos de um perfil.
 */
export const updatePermissionProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    active: z.boolean().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.permission_profiles",
      action: "edit",
      supabase
    });

    const { data: current } = await supabaseAdmin
      .from("permission_profiles")
      .select("is_system, name, active")
      .eq("id", data.id)
      .single();

    if (current?.is_system) {
      if (data.active !== undefined && data.active !== current.active) {
        const error = new Error("SYSTEM_PROFILE_PROTECTED: Não é permitido alterar o status de ativação de perfis de sistema.");
        (error as any).code = "SYSTEM_PROFILE_PROTECTED";
        throw error;
      }
      if (data.name !== current.name) {
        const error = new Error("SYSTEM_PROFILE_PROTECTED: Não é permitido renomear perfis de sistema.");
        (error as any).code = "SYSTEM_PROFILE_PROTECTED";
        throw error;
      }
    }

    const { error } = await supabaseAdmin
      .from("permission_profiles")
      .update({
        name: data.name,
        description: data.description ?? null,
        active: data.active
      })
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });

/**
 * Exclui um perfil de permissão.
 */
export const deletePermissionProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.permission_profiles",
      action: "delete",
      supabase
    });

    const { data: profile } = await supabaseAdmin
      .from("permission_profiles")
      .select("is_system, profiles(id)")
      .eq("id", data.id)
      .single();

    if (profile?.is_system) {
      throw new Error("Perfis de sistema não podem ser excluídos.");
    }

    if ((profile?.profiles as any[])?.length > 0) {
      const error = new Error("PROFILE_IN_USE: Este perfil possui usuários vinculados.");
      (error as any).code = "PROFILE_IN_USE";
      throw error;
    }

    const { error } = await supabaseAdmin
      .from("permission_profiles")
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });
