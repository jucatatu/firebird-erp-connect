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
    const startTs = Date.now();

    console.log(`[ADMIN_CREATE] permission:start user=${execUserId}`);
    // 1. Autenticar administrador e verificar permissão
    await requirePermission({
      userId: execUserId,
      resource: "admin.users",
      action: "create",
      supabase
    });
    console.log(`[ADMIN_CREATE] permission:ok durationMs=${Date.now() - startTs}`);

    const profileStart = Date.now();
    console.log(`[ADMIN_CREATE] profile:start id=${data.permissionProfileId}`);
    // 2. Pré-validar Perfil de Permissões e Normalizar Roles ANTES de criar no Auth
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("permission_profiles")
      .select("id, active, name, is_system")
      .eq("id", data.permissionProfileId)
      .single();

    if (profileErr || !profile) {
      console.error(`[ADMIN_CREATE] failed stage=profile error=NOT_FOUND`);
      const err = new Error("Perfil de permissão inexistente.");
      (err as any).code = "INVALID_PERMISSION_PROFILE";
      throw err;
    }

    if (!profile.active) {
      console.error(`[ADMIN_CREATE] failed stage=profile error=INACTIVE`);
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
      finalRoles = ["vendedor"];
    } else if (profileName === "aprovador") {
      finalRoles = ["aprovador"];
    }

    if (profileName !== "administrador") {
      finalRoles = finalRoles.filter(r => r !== "admin");
    }
    console.log(`[ADMIN_CREATE] profile:ok durationMs=${Date.now() - profileStart}`);

    // 3. Validar Seller no ERP ANTES de criar no Auth
    if (data.erpSellerId !== null) {
      const sellerStart = Date.now();
      console.log(`[ADMIN_CREATE] seller:start id=${data.erpSellerId}`);
      const sellerValidation = await validateErpSellerForCompaniesServer(data.erpSellerId, data.companies);
      if (!sellerValidation.ok) {
        console.error(`[ADMIN_CREATE] failed stage=seller error=${sellerValidation.error?.code}`);
        const err = new Error(sellerValidation.error?.message || "Vendedor inválido.");
        (err as any).code = sellerValidation.error?.code;
        throw err;
      }
      console.log(`[ADMIN_CREATE] seller:ok durationMs=${Date.now() - sellerStart}`);
    }

    const authStart = Date.now();
    console.log(`[ADMIN_CREATE] auth:start email=${data.email}`);
    // 4. Criar usuário no Supabase Auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.temporaryPassword,
      email_confirm: true
    });

    if (authErr) {
      console.error(`[ADMIN_CREATE] failed stage=auth error=${authErr.message}`);
      if (authErr.message.includes("already registered")) {
        throw new Error("Já existe um usuário cadastrado com este e-mail.");
      }
      throw new Error("Falha ao criar usuário no Auth: " + authErr.message);
    }

    const newUserId = authUser.user.id;
    console.log(`[ADMIN_CREATE] auth:ok userId=${newUserId} durationMs=${Date.now() - authStart}`);

    const setupStart = Date.now();
    console.log(`[ADMIN_CREATE] setup:start`);
    try {
      // 5. Executar RPC admin_setup_created_user - Tipagem restaurada
      const { error: setupError } = await supabaseAdmin.rpc("admin_setup_created_user", {
        _user_id: newUserId,
        _full_name: data.fullName,
        _permission_profile_id: data.permissionProfileId,
        _erp_seller_id: data.erpSellerId,
        _company_ids: data.companies as any,
        _roles: finalRoles as any
      });

      if (setupError) {
        const errorCode = setupError.hint || (setupError as any).code;
        console.error(`[ADMIN_CREATE] failed stage=setup error=${errorCode}`);
        
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
      console.log(`[ADMIN_CREATE] setup:ok durationMs=${Date.now() - setupStart}`);
    } catch (e: any) {
      // 6. Compensação: Se setup falhar, excluir usuário Auth criado
      console.warn(`[ADMIN_CREATE] compensating: deleting auth user ${newUserId}`);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw e;
    }

    console.log(`[ADMIN_CREATE] success totalDurationMs=${Date.now() - startTs}`);
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
