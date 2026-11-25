import Link from "next/link";

import { loadActor } from "@/modules/access/actor";
import { requirePageSession } from "@/modules/auth/page-session";
import { listProjects } from "@/modules/projects/service";

export const dynamic = "force-dynamic";

const scenarioLabels: Record<string, string> = {
  OLD_BUILDING_ELEVATOR: "旧楼加装",
  OLD_BUILDING_ADDITION: "旧楼加装",
  EXISTING_ELEVATOR_RENOVATION: "旧梯改造",
  NEW_BUILDING_INSTALLATION: "新楼安装",
};

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
          projects.map((project) => (
            <Link
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-cyan-300"
              href={`/projects/${project.id}`}
              key={project.id}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{project.name}</h2>
                <span className="demo-badge">{project.dataClassification}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{project.projectCode}</p>
              <p className="mt-3 text-slate-600">
                {scenarioLabels[project.projectType] ?? project.projectType}
              </p>
              <p className="mt-2 text-sm text-slate-500">{project.address}</p>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
