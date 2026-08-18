import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "./permissions.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateErpSellerForCompaniesServer } from "@/lib/erp-sellers.server";

/**
 * Cria um novo usuário diretamente no Supabase Auth com senha temporária.
 */
export async function testableCreateAdminUser(data: any, context: any) {
    const { supabase, userId: execUserId } = context;

    // 1. Autenticar administrador e verificar permissão
    await requirePermission({
      userId: execUserId,
      resource: "admin.users",
      action: "create",
      supabase
    });

    // 2. Pré-validar Perfil de Permissões e Normalizar Roles ANTES de criar no Auth
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("permission_profiles")
      .select("id, active, name, is_system")
      .eq("id", data.permissionProfileId)
      .single();

    if (profileErr || !profile) {
      const err = new Error("Perfil de permissão inexistente.");
      (err as any).code = "INVALID_PERMISSION_PROFILE";
      throw err;
    }

    if (!profile.active) {
      const err = new Error("Não é permitido atribuir um perfil inativo.");
      (err as any).code = "INVALID_PERMISSION_PROFILE";
      throw err;
    }

    // Normalização Determinística de Roles ANTES do Auth
    let finalRoles = [...(data.roles || [])];
    const profileName = profile.name?.toLowerCase();

    if (profileName === "administrador") {
      if (!finalRoles.includes("admin")) finalRoles.push("admin");
    } else if (profileName === "vendedor") {
      // Vendedor deve ter somente vendedor nas roles legadas
      finalRoles = ["vendedor"];
    } else if (profileName === "aprovador") {
      // Aprovador deve ter somente aprovador nas roles legadas
      finalRoles = ["aprovador"];
    }

    // Garantir que perfis customizados não ganhem admin indevidamente
    if (profileName !== "administrador") {
      finalRoles = finalRoles.filter(r => r !== "admin");
    }

    // 3. Validar Seller no ERP ANTES de criar no Auth
    if (data.erpSellerId !== null) {
      const sellerValidation = await validateErpSellerForCompaniesServer(data.erpSellerId, data.companies);
      if (!sellerValidation.ok) {
        const err = new Error(sellerValidation.error?.message || "Vendedor inválido.");
        (err as any).code = sellerValidation.error?.code;
        throw err;
      }
    }

    // 4. Criar usuário no Supabase Auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.temporaryPassword,
      email_confirm: true
    });

    if (authErr) {
      if (authErr.message.includes("already registered")) {
        throw new Error("Já existe um usuário cadastrado com este e-mail.");
      }
      throw new Error("Falha ao criar usuário no Auth: " + authErr.message);
    }

    const newUserId = authUser.user.id;

    try {
      // 5. Executar RPC admin_setup_created_user - Tipagem restaurada no types.ts permitirá remover as any depois
      const { error: setupError } = await supabaseAdmin.rpc("admin_setup_created_user", {
        _user_id: newUserId,
        _full_name: data.fullName,
        _permission_profile_id: data.permissionProfileId,
        _erp_seller_id: data.erpSellerId as any,
        _company_ids: data.companies as any,
        _roles: finalRoles as any
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
      // 6. Compensação: Se setup falhar, excluir usuário Auth criado
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw e;
    }

    return { success: true };
}

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    temporaryPassword: z.string().min(8).refine(val => val.trim().length >= 8, {
      message: "Senha deve ter pelo menos 8 caracteres (sem contar apenas espaços)"
    }),
    confirmPassword: z.string().min(8),
    permissionProfileId: z.string(),
    companies: z.array(z.union([z.literal(1), z.literal(3)])).min(1),
    roles: z.array(z.enum(['admin', 'vendedor', 'aprovador'])),
    erpSellerId: z.number().int().positive().nullable()
  }).refine(data => data.temporaryPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"]
  }).parse(data))
  .handler(async ({ data, context }) => {
    return testableCreateAdminUser(data, context);
  });
