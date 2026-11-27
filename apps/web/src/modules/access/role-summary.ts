import { prisma } from "@/server/prisma";

export interface ActorRoleSummary {
  id: string;
  roleCode: string;
  roleName: string;
  roleDescription: string | null;
  scope: "GLOBAL" | "PROJECT";
  projectName: string | null;
  projectCode: string | null;
}

export async function listActorRoleSummaries(
  userId: string,
): Promise<ActorRoleSummary[]> {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      scope: true,
      role: {
        select: {
          code: true,
          name: true,
          description: true,
        },
      },
      project: {
        select: {
          name: true,
          projectCode: true,
        },
      },
    },
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    roleCode: assignment.role.code,
    roleName: assignment.role.name,
    roleDescription: assignment.role.description,
    scope: assignment.scope,
    projectName: assignment.project?.name ?? null,
    projectCode: assignment.project?.projectCode ?? null,
  }));
}
