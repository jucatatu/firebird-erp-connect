import { SupabaseClient } from "@supabase/supabase-js";
import { PermissionAction } from "./permission-types";
import { Database } from "@/integrations/supabase/types";

export interface RequirePermissionOptions {
  userId: string;
  resource: string;
  action: PermissionAction;
  supabase: SupabaseClient<Database>;
}

/**
 * Server-side helper to verify permissions.
 * Throws an error if permission is denied.
 */
export async function requirePermission({
  userId,
  resource,
  action,
  supabase
}: RequirePermissionOptions) {
  const { data: hasPerm, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _resource_key: resource,
    _action: action
  });

  if (error) {
    console.error("[PERMISSION] RPC error:", error);
    throw new Error("Internal Server Error during permission check");
  }

  if (!hasPerm) {
    const errorResponse = {
      ok: false,
      status: 403,
      data: null,
      error: {
        code: "PERMISSION_DENIED",
        message: "Você não possui permissão para executar esta ação.",
        retryable: false,
        details: { resource, action }
      }
    };
    
    // In TanStack Start server functions, we can throw a Response or a structured error
    // For now we return a structure that matches the project's ErpResponse pattern
    // but the caller should check for this.
    throw new Error(JSON.stringify(errorResponse));
  }

  return true;
}
