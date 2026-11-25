import Link from "next/link";

import { loadActor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { requirePageSession } from "@/modules/auth/page-session";

import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageSession("/admin");
  const actor = await loadActor(session.user.id);
  const canManageCustomers = actor.globalPermissions.has(
    PERMISSIONS.CUSTOMER_READ,
  );
  const canManageCatalog = actor.globalPermissions.has(
    PERMISSIONS.CATALOG_MANAGE,
  );
  const canViewSales =
    actor.globalPermissions.has(PERMISSIONS.SALES_MANAGE) ||
    [...actor.projectPermissions.values()].some((permissions) =>
      permissions.has(PERMISSIONS.SALES_MANAGE),
    );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link className="font-semibold" href="/admin">
            AI 电梯选型顾问 · 开发后台
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            {canManageCustomers ? <Link href="/admin/customers">客户</Link> : null}
            <Link href="/admin/projects">项目</Link>
            {canManageCatalog ? <Link href="/admin/products">产品目录</Link> : null}
            {canViewSales ? <Link href="/admin/sales">销售跟进</Link> : null}
            <span>{session.user.name}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
