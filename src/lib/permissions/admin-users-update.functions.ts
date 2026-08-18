import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateErpSellerForCompaniesServer } from "@/lib/erp-sellers.server";

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
      const sellerValidation = await validateErpSellerForCompaniesServer(data.erpSellerId, data.companies);
      if (!sellerValidation.ok) {
        const err = new Error(sellerValidation.error?.message || "Vendedor inválido.");
        (err as any).code = sellerValidation.error?.code;
        throw err;
      }
    }

    // Normalização Determinística de Roles
    let finalRoles = [...(data.roles || [])];
    const profileName = profileDetails?.name?.toLowerCase();

    if (profileName === "administrador") {
      if (!finalRoles.includes("admin")) finalRoles.push("admin");
    } else if (profileName === "vendedor") {
      finalRoles = ["vendedor"];
    } else if (profileName === "aprovador") {
      finalRoles = ["aprovador"];
    }

    if (profileName !== "administrador") {
      finalRoles = finalRoles.filter(r => r !== "admin");
    }

    const { error } = await supabaseAdmin.rpc("admin_update_user", {
      _target_user_id: data.id,
      _full_name: data.fullName,
      _active: data.active,
      _permission_profile_id: data.permissionProfileId,
      _erp_seller_id: data.erpSellerId as any,
      _company_ids: data.companies as any,
      _roles: finalRoles as any
    });

    if (error) {
      const errorCode = error.hint || (error as any).code;
      
      if (errorCode === "LAST_ADMIN_PROTECTION") {
        const err = new Error("Operação bloqueada: Não é possível deixar o sistema sem administradores ativos.");
        (err as any).code = "LAST_ADMIN_PROTECTION";
        throw err;
      }

      if (errorCode === "INVALID_COMPANY_ACCESS") {
        const err = new Error("Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas e pelo menos uma deve ser selecionada.");
        (err as any).code = "INVALID_COMPANY_ACCESS";
        throw err;
      }

      if (errorCode === "INVALID_PERMISSION_PROFILE") {
        const err = new Error("Perfil de permissão inexistente ou inativo.");
        (err as any).code = "INVALID_PERMISSION_PROFILE";
        throw err;
      }
      
      throw error;
    }

    return { success: true };
  });

