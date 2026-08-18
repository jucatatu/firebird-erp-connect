import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateErpSellerForCompanies } from "@/lib/erp-sellers.functions";

/**
 * Helper para testar o envio de convite.
 * exportado para facilitar testes determinísticos.
 */
export async function testableInviteUser(data: any, context: any) {
    const { supabase, userId } = context;

    // 1. Autenticar usuário executor e verificar permissão
    await requirePermission({
      userId,
      resource: "admin.users",
      action: "create",
      supabase
    });

    // 2. Validar Seller no ERP ANTES do convite
    if (data.erpSellerId !== null) {
      const sellerValidation = await validateErpSellerForCompanies(data.erpSellerId, data.companies);
      if (!sellerValidation.ok) {
        const err = new Error(sellerValidation.error?.message || "Vendedor inválido.");
        (err as any).code = sellerValidation.error?.code;
        throw err;
      }
    }

    // 3. Somente se tudo estiver válido, chamar inviteUserByEmail
    const { data: invite, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (inviteErr) throw new Error("Falha ao enviar convite: " + inviteErr.message);

    const newUserId = invite.user.id;

    try {
      // 4. Executar RPC admin_setup_invited_user
      const { error: setupError } = await supabaseAdmin.rpc("admin_setup_invited_user", {
        _user_id: newUserId,
        _full_name: data.fullName,
        _permission_profile_id: data.permissionProfileId,
        _erp_seller_id: data.erpSellerId as any,
        _company_ids: data.companies as any,
        _roles: data.roles as any
      });

      if (setupError) {
        const errorCode = setupError.hint || (setupError as any).code;
        
        if (errorCode === "INVALID_COMPANY_ACCESS") {
          const err = new Error("Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas.");
          (err as any).code = "INVALID_COMPANY_ACCESS";
          throw err;
        }

        if (errorCode === "INVALID_PERMISSION_PROFILE") {
          const err = new Error("Perfil de permissão inexistente ou inativo.");
          (err as any).code = "INVALID_PERMISSION_PROFILE";
          throw err;
        }

        const err = new Error(setupError.message || "Falha na configuração do usuário.");
        (err as any).code = errorCode;
        throw err;
      }
    } catch (e: any) {
      // Compensação
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw e;
    }

    return { success: true };
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    permissionProfileId: z.string(),
    companies: z.array(z.union([z.literal(1), z.literal(3)])).min(1),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().int().positive().nullable()
  }).parse(data))
  .handler(async ({ data, context }) => {
    return testableInviteUser(data, context);
  });
