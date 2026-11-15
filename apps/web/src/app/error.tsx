"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          页面暂时无法加载
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          系统已记录错误摘要，未公开内部技术信息。
        </p>
        <button
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={reset}
          type="button"
        >
          重新尝试
        </button>
      </div>
    </main>
  );
}
