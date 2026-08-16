/**
 * Technical keys for the permission resources tree.
 * Must match the 'key' column in the permission_resources table.
 */
export const PERMISSIONS = {
  OPERATION: {
    ROOT: "operation",
    MAP: "operation.map",
    DELIVERIES: "operation.deliveries",
    PICKUPS: "operation.pickups",
  },

  COMMERCIAL: {
    ROOT: "commercial",
    ORDERS: "commercial.orders",
    APPROVALS: "commercial.order_approvals",
    CLIENTS: "commercial.clients",
  },

  ADMIN: {
    ROOT: "admin",
    USERS: "admin.users",
    PERMISSION_PROFILES: "admin.permission_profiles",
    ERP: "admin.erp",
    CATALOG: "admin.catalog",
    SETTINGS: "admin.settings",
  },
} as const;

export type PermissionKey =
  | (typeof PERMISSIONS.OPERATION)[keyof typeof PERMISSIONS.OPERATION]
  | (typeof PERMISSIONS.COMMERCIAL)[keyof typeof PERMISSIONS.COMMERCIAL]
  | (typeof PERMISSIONS.ADMIN)[keyof typeof PERMISSIONS.ADMIN];
