import { Button } from "@elevator/shared-ui";

const foundationItems = [
  {
    title: "Web 应用",
    description: "Next.js App Router、TypeScript 与响应式基础布局。",
  },
  {
    title: "数据基础",
    description: "PostgreSQL、Prisma 迁移与只读数据库健康检查。",
  },
  {
    title: "工程边界",
    description: "独立 Worker、确定性选型包与共享校验契约。",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 sm:px-8 lg:py-20">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-10">
        <span className="w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-900">
          Phase 1 · 可运行骨架
        </span>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            AI 电梯选型顾问
          </h1>
          <p className="text-lg leading-8 text-slate-600">
            当前版本只提供工程基础能力，尚未开放客户咨询、项目资料、勘察、选型或报价业务。
          </p>
        </div>
        <div>
          <Button asChild variant="outline">
            <a href="/api/health">检查系统健康状态</a>
          </Button>
        </div>
      </header>

      <section className="grid gap-5 py-10 md:grid-cols-3">
        {foundationItems.map((item) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            key={item.title}
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
        本页面不构成产品推荐、工程可行性结论或正式报价。所有后续模拟数据必须标记为
        DEMO_MOCK。
      </footer>
    </main>
  );
}
