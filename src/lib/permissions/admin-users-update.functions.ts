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

    // A RPC admin_update_user já valida:
    // 1. Sincronização Perfil Administrador <=> role admin
    // 2. Proteção do Último Admin (LAST_ADMIN_PROTECTION)
    // 3. Persistência Atômica de todas as tabelas públicas

    // Verificação de permissão server-side básica antes de chamar a RPC
    const isDeactivating = !data.active;
    const action = isDeactivating ? "delete" : "edit";

    await requirePermission({
      userId: execUserId,
      resource: "admin.users",
      action,
      supabase
    });

    const { error } = await supabaseAdmin.rpc("admin_update_user", {
      _target_user_id: data.id,
      _full_name: data.fullName,
      _active: data.active,
      _permission_profile_id: data.permissionProfileId,
      _erp_seller_id: data.erpSellerId as any,
      _company_ids: data.companies,
      _roles: data.roles
    });

    if (error) {
      if (error.hint === "LAST_ADMIN_PROTECTION") {
        const err = new Error("Operação bloqueada: Não é possível deixar o sistema sem administradores ativos.");
        (err as any).code = "LAST_ADMIN_PROTECTION";
        throw err;
      }
      throw error;
    }

    return { success: true };
  });
