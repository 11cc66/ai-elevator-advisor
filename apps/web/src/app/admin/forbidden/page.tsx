import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="rounded-2xl border border-red-200 bg-white p-8">
      <p className="text-sm font-medium text-red-700">403</p>
      <h1 className="mt-2 text-2xl font-semibold">没有访问权限</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        当前账号没有访问此管理功能的权限，权限检查由服务端执行。
        如需访问，请联系管理员核实角色、全局权限或项目范围授权。
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="admin-button" href="/admin">
          返回业务工作台
        </Link>
        <Link className="admin-button-secondary" href="/projects">
          返回我的项目
        </Link>
      </div>
    </section>
  );
}
