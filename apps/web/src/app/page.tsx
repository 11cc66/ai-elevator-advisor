import Link from "next/link";

import { loadActor } from "@/modules/access/actor";
import { getCurrentSession } from "@/modules/auth/session";
import {
  listRecentSelectionRuns,
} from "@/modules/mvp/store";
import { listProjects } from "@/modules/projects/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();
  const actor = session ? await loadActor(session.user.id) : null;
  const projects = actor ? await listProjects(actor) : [];
  const recentRuns = await listRecentSelectionRuns(
    projects.map((project) => project.id),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 sm:px-8 lg:py-20">
      <header className="grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="max-w-3xl space-y-4">
          <span className="w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-900">
            MVP DEMO · MOCK AI · DEMO_MOCK 产品目录
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            AI 电梯选型顾问
          </h1>
          <p className="text-lg leading-8 text-slate-600">
            通过多轮对话整理旧楼加装、旧梯改造和新楼安装需求，
            再用确定性规则给出可追溯的初步产品建议。
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            当前 AI 为确定性 Mock Provider，产品为 DEMO_MOCK。结果不构成正式工程结论、
            真实报价或采购依据，现场勘察和专业审核仍然必需。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Link className="admin-button text-center" href={session ? "/projects" : "/login?next=/projects"}>
            我的项目
          </Link>
          <Link className="admin-button-secondary text-center" href={session ? "/projects/new" : "/login?next=/projects/new"}>
            新建需求项目
          </Link>
          <Link className="text-center text-sm text-cyan-800" href={session ? "/catalog" : "/login?next=/catalog"}>
            查看 DEMO 产品目录
          </Link>
          {session ? (
            <Link className="text-center text-sm text-cyan-800" href="/admin">
              进入管理后台
            </Link>
          ) : (
            <Link className="text-center text-sm text-cyan-800" href="/login">
              登录演示账户
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-5 py-10 md:grid-cols-3">
        {[
          {
            title: "对话采集",
            description: "自然语言描述楼层、层高、预算与外装条件，系统形成结构化需求。",
          },
          {
            title: "规则初筛",
            description: "载重和速度只作为推导结果，硬约束由确定性规则执行。",
          },
          {
            title: "人工边界",
            description: "所有结果标记待专业审核，AI 不替代勘察、结构评估或正式报价。",
          },
        ].map((item) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            key={item.title}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">MVP</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      {session ? (
        <section className="pb-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-cyan-800">最近进展</p>
              <h2 className="mt-1 text-2xl font-semibold">最近推荐方案</h2>
            </div>
            <Link className="text-sm text-cyan-800" href="/projects">查看全部项目</Link>
          </div>
          {recentRuns.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">
              尚无初步推荐。创建项目并完成需求确认后即可运行确定性选型。
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {recentRuns.map((run) => {
                const recommendation = run.result.recommendations[0]
                  ?? run.result.alternatives[0]
                  ?? run.result.improvementCandidates[0];
                return (
                  <Link
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300"
                    href={`/projects/${run.projectId}`}
                    key={run.id}
                  >
                    <p className="text-sm text-slate-500">{run.projectName}</p>
                    <p className="mt-2 font-semibold">
                      {recommendation
                        ? `${recommendation.product.manufacturer} · ${recommendation.product.modelCode}`
                        : "当前无有效匹配"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {recommendation
                        ? `${recommendation.budgetAssessment} · ${recommendation.dataClassification}`
                        : "需要补充条件或调整产品目录"}
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                      {run.createdAt.toLocaleString("zh-CN")} · {run.status}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <footer className="mt-auto border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
        正式产品数据、真实 AI、文件上传、报价与合同能力尚未启用。
      </footer>
    </main>
  );
}
