import Link from "next/link";

import { requirePageSession } from "@/modules/auth/page-session";
import { loadActor } from "@/modules/access/actor";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const session = await requirePageSession("/admin");
  const actor = await loadActor(session.user.id);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-cyan-800">Phase 2</p>
        <h1 className="mt-2 text-3xl font-semibold">业务工作台</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          当前只管理客户、项目、建筑和安装单元的 DEMO
          基础档案，不包含工程确认、选型审核或报价。
        </p>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        <Link
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-cyan-300"
          href="/admin/customers"
        >
          <h2 className="text-lg font-semibold">客户管理</h2>
          <p className="mt-2 text-slate-600">建立演示客户和联系信息。</p>
        </Link>
        <Link
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-cyan-300"
          href="/admin/projects"
        >
          <h2 className="text-lg font-semibold">项目管理</h2>
          <p className="mt-2 text-slate-600">
            建立旧楼加装 DEMO 项目、建筑和安装单元。
          </p>
        </Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        当前账号权限：{actor.globalPermissions.size > 0 ? "已加载服务端权限" : "无全局权限"}
      </section>
    </div>
  );
}
