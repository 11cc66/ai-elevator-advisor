export function LoadingPanel({
  label = "正在加载当前页面…",
}: {
  label?: string;
}) {
  return (
    <div
      aria-live="polite"
      className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
      role="status"
    >
      <div
        aria-hidden="true"
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-700"
      />
      <p className="mt-4 text-sm text-slate-600">{label}</p>
    </div>
  );
}
