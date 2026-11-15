export default function ForbiddenPage() {
  return (
    <section className="rounded-2xl border border-red-200 bg-white p-8">
      <p className="text-sm font-medium text-red-700">403</p>
      <h1 className="mt-2 text-2xl font-semibold">没有访问权限</h1>
      <p className="mt-3 text-slate-600">
        当前账号没有访问此管理功能的权限，权限检查由服务端执行。
      </p>
    </section>
  );
}
