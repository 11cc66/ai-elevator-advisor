import { prisma } from "@/server/prisma";

import type { PermissionCode } from "./permissions";

export interface Actor {
  userId: string;
  globalPermissions: ReadonlySet<PermissionCode>;
  projectPermissions: ReadonlyMap<string, ReadonlySet<PermissionCode>>;
}

export async function loadActor(userId: string): Promise<Actor> {
  const assignments = await prisma.userRole.findMany({
    where: {
      userId,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  const globalPermissions = new Set<PermissionCode>();
  const projectPermissions = new Map<string, Set<PermissionCode>>();

  for (const assignment of assignments) {
    const target =
      assignment.scope === "PROJECT" && assignment.projectId
        ? projectPermissions.get(assignment.projectId) ??
          new Set<PermissionCode>()
        : globalPermissions;

    for (const { permissionCode } of assignment.role.permissions) {
      target.add(permissionCode as PermissionCode);
    }

    if (assignment.scope === "PROJECT" && assignment.projectId) {
      projectPermissions.set(assignment.projectId, target);
    }
  }

  return {
    userId,
    globalPermissions,
    projectPermissions,
  };
}
