import { SupabaseClient } from "@supabase/supabase-js";
import { PermissionAction } from "./permission-types";
import { Database } from "@/integrations/supabase/types";

export interface PermissionDeniedDetails {
  resource: string;
  action: PermissionAction;
}

export class PermissionDeniedError extends Error {
  public status = 403;
  public code = "PERMISSION_DENIED";
  public details: PermissionDeniedDetails;

  constructor(resource: string, action: PermissionAction) {
    super("Você não possui permissão para executar esta ação.");
    this.name = "PermissionDeniedError";
    this.details = { resource, action };
  }
}

export class PermissionCheckError extends Error {
  public status = 500;
  public code = "PERMISSION_CHECK_FAILED";

  constructor(originalError?: any) {
    super("Erro interno ao validar permissões.");
    this.name = "PermissionCheckError";
    if (originalError) {
      console.error("[PERMISSION] RPC Technical failure:", originalError);
    }
  }
}

export interface RequirePermissionOptions {
  userId: string;
  resource: string;
  action: PermissionAction;
  supabase: SupabaseClient<Database>;
}

/**
 * Server-side helper to verify permissions.
 * Throws PermissionDeniedError (403) or PermissionCheckError (500).
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
    throw new PermissionCheckError(error);
  }

  if (hasPerm !== true) {
    throw new PermissionDeniedError(resource, action);
  }

  return true;
}