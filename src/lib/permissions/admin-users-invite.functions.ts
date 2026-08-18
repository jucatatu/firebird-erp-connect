import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    permissionProfileId: z.string(),
    companies: z.array(z.union([z.literal(1), z.literal(3)])).min(1),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().nullable()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.users",
      action: "create",
      supabase
    });

    // 1. Criar convite no Supabase Auth
    const { data: invite, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (inviteErr) throw new Error("Falha ao enviar convite: " + inviteErr.message);

    const newUserId = invite.user.id;

    try {
      // Sprint 8.9.43.2: Validar erpSellerId server-side antes de persistir
      if (data.erpSellerId) {
        const { getErpSellerDetail } = await import("@/lib/erp-orders.functions");
        const sellerResult = await getErpSellerDetail({ data: data.erpSellerId });
        
        if (!sellerResult.ok || !sellerResult.data?.seller) {
          const err = new Error("O vendedor selecionado não existe mais no ERP.");
          (err as any).code = "SELLER_NOT_FOUND";
          throw err;
        }

        const seller = sellerResult.data.seller;
        if (!data.companies.includes(seller.companyId as any)) {
          const err = new Error("O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário.");
          (err as any).code = "SELLER_COMPANY_MISMATCH";
          throw err;
        }
      }

      // 2. Configurar perfil e tabelas relacionadas ATOMICAMENTE via RPC
      const { error: setupError } = await supabaseAdmin.rpc("admin_setup_invited_user", {
        _user_id: newUserId,
        _full_name: data.fullName,
        _permission_profile_id: data.permissionProfileId,
        _erp_seller_id: data.erpSellerId as any,
        _company_ids: data.companies as any,
        _roles: data.roles as any
      });


      if (setupError) {
        // Prioridade: hint (aplicação) -> code (PostgreSQL genérico)
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
        
        throw setupError;
      }
    } catch (e: any) {
      console.error("[INVITE] Falha na configuração pós-convite. Tentando compensação...", e);
      // Compensação: Remove o usuário convidado se a configuração falhar para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Usuário convidado, mas falha na configuração: ${e.message || 'Erro desconhecido'}`);
    }

    return { success: true };
  });
