import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateErpSellerForCompanies } from "@/lib/erp-sellers.functions";

/**
 * Atualiza um usuário existente.
 */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string(),
    fullName: z.string().min(1),
    permissionProfileId: z.string(),
    companies: z.array(z.union([z.literal(1), z.literal(3)])).min(1),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().int().positive().nullable(),
    active: z.boolean()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId: execUserId } = context;

    const isDeactivating = !data.active;
    const action = isDeactivating ? "delete" : "edit";

    await requirePermission({
      userId: execUserId,
      resource: "admin.users",
      action,
      supabase
    });

    // Validar Seller no ERP quando não-null
    if (data.erpSellerId !== null) {
      const sellerValidation = await validateErpSellerForCompanies(data.erpSellerId, data.companies);
      if (!sellerValidation.ok) {
        const err = new Error(sellerValidation.error?.message || "Vendedor inválido.");
        (err as any).code = sellerValidation.error?.code;
        throw err;
      }
    }

    const { error } = await supabaseAdmin.rpc("admin_update_user", {
      _target_user_id: data.id,
      _full_name: data.fullName,
      _active: data.active,
      _permission_profile_id: data.permissionProfileId,
      _erp_seller_id: data.erpSellerId as any,
      _company_ids: data.companies as any,
      _roles: data.roles as any
    });

    if (error) {
      const errorCode = error.hint || (error as any).code;
      
      if (errorCode === "LAST_ADMIN_PROTECTION") {
        throw new Error("Operação bloqueada: Não é possível deixar o sistema sem administradores ativos.");
      }

      if (errorCode === "INVALID_COMPANY_ACCESS") {
        throw new Error("Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas e pelo menos uma deve ser selecionada.");
      }

      if (errorCode === "INVALID_PERMISSION_PROFILE") {
        throw new Error("Perfil de permissão inexistente ou inativo.");
      }
      
      throw error;
    }

    return { success: true };
  });

