export const PERMISSIONS = {
  CUSTOMER_READ: "customer.read",
  CUSTOMER_MANAGE: "customer.manage",
  PROJECT_READ: "project.read",
  PROJECT_MANAGE: "project.manage",
  AUDIT_READ: "audit.read",
} as const;

export type PermissionCode =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ADMIN_ROLE = "SYSTEM_ADMIN";
