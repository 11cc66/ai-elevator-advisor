import { AppError } from "@/server/http/errors";

import type { Actor } from "./actor";
import type { PermissionCode } from "./permissions";

export function hasGlobalPermission(
  actor: Actor,
  permission: PermissionCode,
): boolean {
  return actor.globalPermissions.has(permission);
}

export function canAccessProject(
  actor: Actor,
  projectId: string,
  permission: PermissionCode,
): boolean {
  return (
    hasGlobalPermission(actor, permission) ||
    (actor.projectPermissions.get(projectId)?.has(permission) ?? false)
  );
}

export function requireGlobalPermission(
  actor: Actor,
  permission: PermissionCode,
): void {
  if (!hasGlobalPermission(actor, permission)) {
    throw new AppError(
      "FORBIDDEN",
      "当前账号没有执行此操作的权限。",
      403,
    );
  }
}

export function requireProjectPermission(
  actor: Actor,
  projectId: string,
  permission: PermissionCode,
): void {
  if (!canAccessProject(actor, projectId, permission)) {
    throw new AppError(
      "PROJECT_ACCESS_DENIED",
      "当前账号无权访问该项目。",
      403,
    );
  }
}
