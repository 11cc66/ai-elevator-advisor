import { redirect } from "next/navigation";

import { loadActor } from "@/modules/access/actor";
import {
  hasGlobalPermission,
  requireGlobalPermission,
} from "@/modules/access/policy";
import type { PermissionCode } from "@/modules/access/permissions";

import { getCurrentSession } from "./session";

export async function requirePageSession(nextPath: string) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}

export async function requireAdminPermission(permission: PermissionCode) {
  const session = await requirePageSession("/admin");
  const actor = await loadActor(session.user.id);

  if (!hasGlobalPermission(actor, permission)) {
    redirect("/admin/forbidden");
  }

  requireGlobalPermission(actor, permission);

  return {
    actor,
    session,
  };
}

export function safeAdminNextPath(value: string | undefined): string {
  return value?.startsWith("/admin") ? value : "/admin";
}
