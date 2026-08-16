export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface PermissionFlags {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionMap = Record<string, PermissionFlags>;

export interface UserPermissionProfile {
  id: string;
  name: string;
  is_system: boolean;
  active: boolean;
}
