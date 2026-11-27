import Link from "next/link";

import { loadActor } from "@/modules/access/actor";
import { requirePageSession } from "@/modules/auth/page-session";
import { listProjects } from "@/modules/projects/service";
import {
  getDataClassificationPresentation,
  getProjectRecordStatusLabel,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";

import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function CustomerProjectsPage() {
  const session = await requirePageSession("/projects");
  const actor = await loadActor(session.user.id);
  const projects = await listProjects(actor);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-800">客户工作台</p>
          <h1 className="mt-2 text-3xl font-semibold">我的项目</h1>
          <p className="mt-2 text-slate-600">
            仅显示当前账号拥有项目范围权限的记录。
          </p>
        </div>
        <div className="flex gap-3">
          <Link className="admin-button" href="/projects/new">新建项目</Link>
          <Link className="admin-button-secondary" href="/">返回首页</Link>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {projects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-slate-500">
            尚无项目。请先新建一个 DEMO 需求项目。
          </p>
        ) : (
          projects.map((project) => {
            const scenario = getScenarioPresentation(project.projectType);
            const status = getProjectRecordStatusLabel(project.status);
            const classification = getDataClassificationPresentation(
              project.dataClassification,
            );

            return (
              <Link
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-cyan-300"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  <StatusBadge label={status} tone="neutral" />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {project.projectCode}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={scenario.label} tone={scenario.tone} />
                  <StatusBadge
                    label={classification.label}
                    tone={classification.tone}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {scenario.description}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {project.address}
                </p>
                <p className="mt-4 text-sm font-medium text-cyan-800">
                  进入项目查看需求、方案和销售进展
                </p>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}
