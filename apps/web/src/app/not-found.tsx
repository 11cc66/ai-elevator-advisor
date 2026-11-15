import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-cyan-800">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          页面不存在
        </h1>
        <Link
          className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          href="/"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
