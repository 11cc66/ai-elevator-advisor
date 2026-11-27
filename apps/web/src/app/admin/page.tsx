import Link from "next/link";

import { loadActor } from "@/modules/access/actor";
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
} from "@/modules/access/permissions";
import { hasGlobalPermission } from "@/modules/access/policy";
import { listActorRoleSummaries } from "@/modules/access/role-summary";
import { requirePageSession } from "@/modules/auth/page-session";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const session = await requirePageSession("/admin");
  const [actor, roles] = await Promise.all([
    loadActor(session.user.id),
    listActorRoleSummaries(session.user.id),
  ]);
  const capabilities = [
    {
      href: "/admin/customers",
      title: "客户管理",
      description: "查看客户档案；创建操作由客户维护权限控制。",
      allowed: hasGlobalPermission(actor, PERMISSIONS.CUSTOMER_READ),
      editable: hasGlobalPermission(actor, PERMISSIONS.CUSTOMER_MANAGE),
    },
    {
      href: "/admin/projects",
      title: "项目工作台",
      description: "查看需求、方案和项目资料；项目维护权限控制新增操作。",
      allowed:
        hasGlobalPermission(actor, PERMISSIONS.PROJECT_READ) ||
        [...actor.projectPermissions.values()].some((permissions) =>
          permissions.has(PERMISSIONS.PROJECT_READ),
        ),
      editable:
        hasGlobalPermission(actor, PERMISSIONS.PROJECT_MANAGE) ||
        [...actor.projectPermissions.values()].some((permissions) =>
          permissions.has(PERMISSIONS.PROJECT_MANAGE),
        ),
    },
    {
      href: "/admin/products",
      title: "产品目录",
      description: "查看和维护演示产品资料。",
      allowed: hasGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE),
      editable: hasGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE),
    },
    {
      href: "/admin/sales",
      title: "销售跟进",
      description: "处理分配给当前账号的销售交接。",
      allowed:
        hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE) ||
        [...actor.projectPermissions.values()].some((permissions) =>
          permissions.has(PERMISSIONS.SALES_MANAGE),
        ),
      editable:
        hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE) ||
        [...actor.projectPermissions.values()].some((permissions) =>
          permissions.has(PERMISSIONS.SALES_MANAGE),
        ),
    },
  ].filter((item) => item.allowed);

  const globalPermissions = [...actor.globalPermissions];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-cyan-800">业务后台</p>
        <h1 className="mt-2 text-3xl font-semibold">当前账号工作台</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          页面会按当前账号已有权限显示入口和可操作状态。页面隐藏按钮只改善使用体验，实际安全控制仍由服务端鉴权执行。
        </p>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        {capabilities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
            当前账号尚未分配可进入的管理功能。
          </p>
        ) : (
          capabilities.map((capability) => (
            <Link
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-cyan-300"
              href={capability.href}
              key={capability.href}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{capability.title}</h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  {capability.editable ? "可操作" : "只读"}
                </span>
              </div>
              <p className="mt-2 text-slate-600">
                {capability.description}
              </p>
            </Link>
          ))
        )}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">已分配角色</h2>
          {roles.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              尚未读取到角色分配，请联系管理员核实账号配置。
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {roles.map((role) => (
                <li
                  className="rounded-xl bg-slate-50 p-3 text-sm"
                  key={role.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{role.roleName}</p>
                    <span className="text-xs text-slate-500">
                      {role.scope === "GLOBAL"
                        ? "全局角色"
                        : `项目：${role.projectName ?? "项目待确认"}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {role.roleDescription ?? `角色代码：${role.roleCode}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">权限范围摘要</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">全局权限</dt>
              <dd className="mt-1 text-xl font-semibold">
                {globalPermissions.length}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">项目范围</dt>
              <dd className="mt-1 text-xl font-semibold">
                {actor.projectPermissions.size}
              </dd>
            </div>
          </dl>
          {globalPermissions.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              {globalPermissions.slice(0, 8).map((permission) => (
                <li
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                  key={permission}
                >
                  {PERMISSION_DESCRIPTIONS[permission]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              当前没有全局业务权限，仅可使用已分配的项目范围能力。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
