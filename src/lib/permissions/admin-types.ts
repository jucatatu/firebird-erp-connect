import { z } from "zod";

export const UserStatusSchema = z.enum(["active", "inactive", "all"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export interface ErpSeller {
  id: number;
  name: string;
  active?: boolean;
}

export interface UserCompanyAccess {
  userId: string;
  companyId: 1 | 3;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  active: boolean;
  permissionProfileId: string | null;
  permissionProfileName?: string;
  erpSellerId: number | null;
  erpSellerName?: string;
  companies: number[];
  roles: string[];
}

export interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  isSystem: boolean;
  userCount: number;
}

export interface PermissionResource {
  id: string;
  key: string;
  label: string;
  parentId: string | null;
  sortOrder: number;
}

export interface PermissionRule {
  resourceId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
